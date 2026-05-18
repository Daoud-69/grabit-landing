"""Grabit API — Vercel serverless function.

Vercel's serverless runtime has no ffmpeg and a 60s execution limit, so:
  - /api/preview        link metadata + thumbnail        (works well)
  - /api/download mp4   progressive MP4                   (works for shorter clips)
  - /api/download m4a   audio-only download               (works)
  - /api/download mp3   needs ffmpeg -> 501 on Vercel
For unrestricted downloads (any quality, MP3, long videos) run the Docker
backend instead — see ../Dockerfile and ../backend/server.py.
"""

import os
import re
import secrets
import shutil
import tempfile
from typing import List, Optional
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask
from yt_dlp import YoutubeDL

app = FastAPI(title="Grabit API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Basic Auth ───────────────────────────────────────────────────────────────
_AUTH_USER = os.environ.get("GRABIT_USER", "")
_AUTH_PASS = os.environ.get("GRABIT_PASS", "")
_http_basic = HTTPBasic(auto_error=True)


def require_auth(credentials: HTTPBasicCredentials = Depends(_http_basic)):
    if not _AUTH_USER or not _AUTH_PASS:
        return
    valid = secrets.compare_digest(
        credentials.username.encode(), _AUTH_USER.encode()
    ) and secrets.compare_digest(
        credentials.password.encode(), _AUTH_PASS.encode()
    )
    if not valid:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials.",
            headers={"WWW-Authenticate": "Basic"},
        )

# ── Platform detection ──────────────────────────────────────────────────────
PLATFORM_PATTERNS = [
    ("youtube", re.compile(r"(?:youtube\.com|youtu\.be)", re.I)),
    ("tiktok", re.compile(r"tiktok\.com", re.I)),
    ("instagram", re.compile(r"instagram\.com", re.I)),
    ("facebook", re.compile(r"(?:facebook\.com|fb\.watch)", re.I)),
    ("x", re.compile(r"(?:twitter\.com|x\.com)", re.I)),
]


def detect_platform(url: str) -> str:
    for name, pattern in PLATFORM_PATTERNS:
        if pattern.search(url):
            return name
    return "unknown"


# ── URL validation (also blocks SSRF to internal networks) ──────────────────
_PRIVATE_HOSTS = {
    "localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]",
    "169.254.169.254", "metadata.google.internal",
}


def is_safe_url(raw: str) -> bool:
    if not raw or not isinstance(raw, str) or len(raw) > 2048:
        return False
    try:
        u = urlparse(raw)
    except Exception:
        return False
    if u.scheme not in ("http", "https"):
        return False
    host = (u.hostname or "").lower()
    if not host or host in _PRIVATE_HOSTS:
        return False
    if host.endswith(".local") or host.endswith(".internal"):
        return False
    if re.match(r"^10\.", host) or re.match(r"^192\.168\.", host):
        return False
    if re.match(r"^172\.(1[6-9]|2\d|3[01])\.", host):
        return False
    return True


# ── yt-dlp helpers ──────────────────────────────────────────────────────────
# The ios/tv clients bypass YouTube's datacenter-IP blocking; the default
# client is tried first because forcing those clients can trip DRM checks.
YT_CLIENTS = ["ios", "tv_embedded", "web_creator", "tv", "mediaconnect"]


def _run_ytdlp(url: str, extra: dict, download: bool):
    """Run yt-dlp, retrying YouTube with alternate clients on failure."""
    attempts: List[Optional[dict]] = [None]
    if detect_platform(url) == "youtube":
        attempts.append({"youtube": {"player_client": YT_CLIENTS}})

    last_exc: Optional[Exception] = None
    for extractor_args in attempts:
        opts = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "socket_timeout": 20,
            "cachedir": False,
        }
        if extractor_args:
            opts["extractor_args"] = extractor_args
        opts.update(extra)
        try:
            with YoutubeDL(opts) as ydl:
                return ydl.extract_info(url, download=download)
        except Exception as exc:  # noqa: BLE001 - yt-dlp raises many types
            last_exc = exc
    raise last_exc if last_exc else RuntimeError("yt-dlp failed")


def friendly_error(exc: Exception, platform: str):
    msg = str(exc).lower()
    if (
        "sign in to confirm" in msg
        or "confirm you're not a bot" in msg
        or "confirm you are not a bot" in msg
        or ("bot" in msg and "youtube" in msg)
    ):
        return 403, (
            "YouTube is blocking this server's IP (cloud datacenter). This "
            "affects every cloud-hosted downloader — try another platform, "
            "or run Grabit locally where it uses your home connection."
        )
    if "private" in msg or "members-only" in msg or "members only" in msg:
        return 403, "This content is private or members-only."
    if "login" in msg or "log in" in msg or "cookies" in msg or "sign in" in msg:
        labels = {"instagram": "Instagram", "facebook": "Facebook", "x": "X"}
        name = labels.get(platform, "This platform")
        return 403, f"{name} requires a logged-in session to access this content."
    if "geo" in msg or "not available in your" in msg:
        return 403, "This content is geo-restricted."
    if "404" in msg or "not found" in msg or "unavailable" in msg or "removed" in msg:
        return 404, "Content not found — it may have been deleted or the link is wrong."
    if "unsupported url" in msg or "no video" in msg:
        return 400, "No downloadable media was found at that link."
    return 502, "Couldn't process that link — it may be private, removed, or unsupported."


STANDARD_RES = [2160, 1440, 1080, 720, 480, 360]


def available_resolutions(info: dict) -> List[int]:
    heights = set()
    for f in info.get("formats") or []:
        h = f.get("height")
        if isinstance(h, int) and h > 0 and f.get("vcodec") not in (None, "none"):
            heights.add(h)
    if not heights and isinstance(info.get("height"), int):
        heights.add(info["height"])
    if not heights:
        return [720, 480, 360]
    top = max(heights)
    standard = [r for r in STANDARD_RES if r <= top]
    return standard or [top]


def fmt_duration(sec) -> Optional[str]:
    if not isinstance(sec, (int, float)) or sec <= 0:
        return None
    sec = int(sec)
    h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


# ── Models ──────────────────────────────────────────────────────────────────
class PreviewRequest(BaseModel):
    url: str


class PreviewResponse(BaseModel):
    platform: str
    original_url: str
    supported: bool = True
    title: Optional[str] = None
    thumbnail: Optional[str] = None
    author: Optional[str] = None
    duration: Optional[str] = None
    duration_seconds: Optional[int] = None
    view_count: Optional[int] = None
    available_resolutions: List[int] = Field(default_factory=list)
    has_audio: bool = True


# ── Routes ──────────────────────────────────────────────────────────────────
@app.get("/api")
@app.get("/api/")
def root():
    return {"message": "Grabit API alive"}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "runtime": "vercel",
        "ffmpeg": shutil.which("ffmpeg") is not None,
    }


@app.post("/api/preview", response_model=PreviewResponse)
def preview(req: PreviewRequest, _: None = Depends(require_auth)):
    url = (req.url or "").strip()
    if not is_safe_url(url):
        raise HTTPException(400, "Please paste a valid public http(s) link.")

    platform = detect_platform(url)
    try:
        info = _run_ytdlp(url, {"skip_download": True}, download=False)
    except Exception as exc:  # noqa: BLE001
        code, detail = friendly_error(exc, platform)
        raise HTTPException(code, detail)

    formats = info.get("formats") or []
    has_audio = any(f.get("acodec") not in (None, "none") for f in formats) or bool(formats)
    dur = info.get("duration")
    views = info.get("view_count")

    return PreviewResponse(
        platform=platform,
        original_url=url,
        supported=True,
        title=(info.get("title") or "Untitled")[:200],
        thumbnail=info.get("thumbnail"),
        author=info.get("uploader") or info.get("channel") or info.get("uploader_id"),
        duration=fmt_duration(dur),
        duration_seconds=int(dur) if isinstance(dur, (int, float)) else None,
        view_count=views if isinstance(views, int) else None,
        available_resolutions=available_resolutions(info),
        has_audio=has_audio,
    )


ALLOWED_TYPES = {"mp4", "mp3", "m4a"}
RES_MAP = {"2160": 2160, "1440": 1440, "1080": 1080, "720": 720, "480": 480, "360": 360}


@app.get("/api/download")
def download(
    url: str = Query(...),
    type: str = Query("mp4"),
    quality: str = Query(""),
    _: None = Depends(require_auth),
):
    if not is_safe_url(url):
        raise HTTPException(400, "Please provide a valid public http(s) link.")
    if type not in ALLOWED_TYPES:
        raise HTTPException(400, "type must be one of: mp4, mp3, m4a")
    if type == "mp3" and shutil.which("ffmpeg") is None:
        raise HTTPException(
            501,
            "MP3 conversion needs ffmpeg, which isn't available on this "
            "serverless deployment. Choose M4A for audio, or run the "
            "self-hosted Docker backend for MP3.",
        )

    platform = detect_platform(url)
    tmpdir = tempfile.mkdtemp(prefix="grabit-")
    outtmpl = os.path.join(tmpdir, "grabit.%(ext)s")

    if type in ("mp3", "m4a"):
        fmt = "bestaudio[ext=m4a]/bestaudio"
    else:
        height = RES_MAP.get(re.sub(r"\D", "", quality or ""), 720)
        # Progressive formats only — there's no ffmpeg here to merge
        # separate video/audio streams.
        fmt = (
            f"best[ext=mp4][height<={height}]/"
            f"best[height<={height}][acodec!=none][vcodec!=none]/best"
        )

    try:
        _run_ytdlp(url, {"format": fmt, "outtmpl": outtmpl}, download=True)
    except Exception as exc:  # noqa: BLE001
        shutil.rmtree(tmpdir, ignore_errors=True)
        code, detail = friendly_error(exc, platform)
        raise HTTPException(code, detail)

    files = [
        os.path.join(tmpdir, f)
        for f in os.listdir(tmpdir)
        if os.path.isfile(os.path.join(tmpdir, f))
    ]
    if not files:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(502, "Download failed — no media was produced.")

    path = max(files, key=os.path.getsize)
    ext = (os.path.splitext(path)[1].lstrip(".") or "mp4").lower()
    media_type = {
        "mp4": "video/mp4", "webm": "video/webm",
        "m4a": "audio/mp4", "mp3": "audio/mpeg", "opus": "audio/ogg",
    }.get(ext, "application/octet-stream")

    return FileResponse(
        path,
        media_type=media_type,
        filename=f"grabit.{ext}",
        background=BackgroundTask(shutil.rmtree, tmpdir, True),
    )
