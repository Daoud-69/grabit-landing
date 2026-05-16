"""Grabit backend — video & audio downloader powered by yt-dlp.

Routes (all under /api):
  GET  /             -> liveness message
  GET  /health       -> tool availability (yt-dlp / ffmpeg / mongo)
  POST /preview      -> metadata + available formats for a link
  GET  /download     -> stream the video (mp4) or audio (mp3 / m4a)
  POST /status       -> legacy status check (only when MONGO_URL is set)
  GET  /status       -> legacy status checks

When a built React app exists at ../frontend/build it is also served, so the
whole product can run as a single process.
"""

import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field
from starlette.background import BackgroundTask
from starlette.middleware.cors import CORSMiddleware
from urllib.parse import urlparse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("grabit")

# ── Optional MongoDB — only used by the legacy /status endpoints ────────────
db = None
mongo_client = None
_mongo_url = os.environ.get("MONGO_URL")
if _mongo_url:
    try:
        from motor.motor_asyncio import AsyncIOMotorClient

        mongo_client = AsyncIOMotorClient(_mongo_url)
        db = mongo_client[os.environ.get("DB_NAME", "grabit")]
        logger.info("MongoDB connected")
    except Exception as exc:  # pragma: no cover - depends on env
        logger.warning(f"MongoDB unavailable, /status disabled: {exc}")

# ── External tools ──────────────────────────────────────────────────────────
YTDLP = shutil.which("yt-dlp") or "yt-dlp"
FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
HAS_FFMPEG = shutil.which("ffmpeg") is not None

app = FastAPI(title="Grabit API")
api_router = APIRouter(prefix="/api")


# ── Models ──────────────────────────────────────────────────────────────────
class PreviewRequest(BaseModel):
    url: str


class PreviewResponse(BaseModel):
    platform: str  # youtube | tiktok | instagram | facebook | x | unknown
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


class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


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
# The ios client bypasses datacenter-IP blocking best on cloud servers.
YT_CLIENTS = "ios,tv_embedded,web_creator,tv,mediaconnect"
MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
    "Mobile/15E148 Safari/604.1"
)


def _youtube_attempts(url: str) -> List[List[str]]:
    """Extra arg-sets to try in order. The default client works from
    residential IPs; the ios/tv client set is the fallback for datacenter
    IPs that YouTube blocks with bot checks."""
    if detect_platform(url) != "youtube":
        return [[]]
    return [
        [],
        [
            "--extractor-args", f"youtube:player_client={YT_CLIENTS}",
            "--add-header", f"User-Agent:{MOBILE_UA}",
        ],
    ]


class YtdlpError(Exception):
    def __init__(self, stderr: str):
        self.stderr = stderr or ""
        super().__init__(self.stderr[:300])


def fetch_info(url: str) -> dict:
    last_err = "could not read that link"
    for extra in _youtube_attempts(url):
        args = [
            YTDLP, "--dump-single-json", "--no-warnings", "--no-playlist",
            "--socket-timeout", "20", *extra, url,
        ]
        try:
            proc = subprocess.run(args, capture_output=True, text=True, timeout=60)
        except FileNotFoundError:
            raise HTTPException(500, "yt-dlp is not installed on the server.")
        except subprocess.TimeoutExpired:
            last_err = "timed out while reading the link"
            continue
        if proc.returncode == 0:
            try:
                return json.loads(proc.stdout)
            except json.JSONDecodeError:
                last_err = "could not parse the video metadata"
                continue
        last_err = proc.stderr or last_err
    raise YtdlpError(last_err)


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
        # Some extractors expose a single progressive stream with no heights.
        return [1080, 720, 480, 360] if (info.get("formats") or info.get("url")) else []
    top = max(heights)
    standard = [r for r in STANDARD_RES if r <= top]
    # Very low-res sources fall below the 360p floor — offer the real height.
    return standard or [top]


def fmt_duration(sec) -> Optional[str]:
    if not isinstance(sec, (int, float)) or sec <= 0:
        return None
    sec = int(sec)
    h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def friendly_error(stderr: str, platform: str):
    """Map a yt-dlp stderr blob to an (http_status, human_message) pair."""
    msg = (stderr or "").lower()
    if "sign in to confirm" in msg or ("bot" in msg and "youtube" in msg):
        return 403, ("YouTube is blocking this server's IP. Try again later, "
                     "or host Grabit on a residential connection.")
    if "private" in msg or "members-only" in msg or "members only" in msg:
        return 403, "This content is private or members-only."
    if "login" in msg or "log in" in msg or "cookies" in msg or "authentication" in msg:
        labels = {"instagram": "Instagram", "facebook": "Facebook", "x": "X"}
        name = labels.get(platform, "This platform")
        return 403, f"{name} requires a logged-in session to access this content."
    if "geo" in msg or "not available in your" in msg:
        return 403, "This content is geo-restricted and unavailable from this server."
    if "age" in msg and ("verif" in msg or "confirm" in msg):
        return 403, "This content requires age verification."
    if "404" in msg or "not found" in msg or "unavailable" in msg or "has been removed" in msg:
        return 404, "Content not found — it may have been deleted or the link is wrong."
    if "unsupported url" in msg or "no video" in msg or "no suitable" in msg:
        return 400, "No downloadable media was found at that link."
    return 502, ("Couldn't process that link — the content may be private, "
                 "removed, or unsupported.")


# ── Concurrency + rate limiting ─────────────────────────────────────────────
MAX_CONCURRENT = 3
_active = 0
_active_lock = threading.Lock()


class _Slot:
    """Caps how many heavy yt-dlp jobs run at once."""

    def __enter__(self):
        global _active
        with _active_lock:
            if _active >= MAX_CONCURRENT:
                raise HTTPException(503, "Server is busy — please try again in a moment.")
            _active += 1
        return self

    def __exit__(self, *exc):
        global _active
        with _active_lock:
            _active = max(0, _active - 1)


_RATE: dict = {}
_rate_lock = threading.Lock()


def rate_limit(ip: str, limit: int, window: float = 60.0):
    now = time.time()
    with _rate_lock:
        hits = [t for t in _RATE.get(ip, []) if now - t < window]
        if len(hits) >= limit:
            raise HTTPException(429, "Too many requests — please wait a minute.")
        hits.append(now)
        _RATE[ip] = hits


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── Routes ──────────────────────────────────────────────────────────────────
@api_router.get("/")
async def root():
    return {"message": "Grabit API alive"}


@api_router.get("/health")
def health():
    def first_line(cmd):
        try:
            out = subprocess.run(
                [cmd, "--version"], capture_output=True, text=True, timeout=5
            ).stdout.strip().splitlines()
            return out[0] if out else None
        except Exception:
            return None

    return {
        "status": "ok",
        "ytdlp": first_line(YTDLP),
        "ffmpeg": HAS_FFMPEG,
        "mongo": db is not None,
    }


@api_router.post("/preview", response_model=PreviewResponse)
def preview(req: PreviewRequest, request: Request):
    url = (req.url or "").strip()
    if not is_safe_url(url):
        raise HTTPException(400, "Please paste a valid public http(s) link.")
    rate_limit(_client_ip(request), limit=20)

    platform = detect_platform(url)
    try:
        info = fetch_info(url)
    except YtdlpError as exc:
        code, detail = friendly_error(exc.stderr, platform)
        raise HTTPException(code, detail)

    formats = info.get("formats") or []
    has_audio = any(f.get("acodec") not in (None, "none") for f in formats) \
        or bool(formats) or bool(info.get("url"))
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
ALLOWED_MP3_BITRATE = {"320", "192", "128"}
RES_MAP = {"2160": 2160, "1440": 1440, "1080": 1080, "720": 720, "480": 480, "360": 360}


def _open_audio_pipeline(url: str, extra: List[str], fmt_type: str, bitrate: str):
    """Start yt-dlp (plus ffmpeg for mp3) and block for the first output chunk.

    Returns (first_chunk, readable_stream, procs) on success, or None if the
    source produced nothing — which lets the caller retry another client."""
    yt_args = [
        YTDLP, "--no-warnings", "--no-playlist", "--socket-timeout", "20",
        *extra, "-f", "bestaudio/best", "-o", "-", url,
    ]
    try:
        yt = subprocess.Popen(yt_args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    except FileNotFoundError:
        raise HTTPException(500, "yt-dlp is not installed on the server.")

    if fmt_type == "mp3":
        conv = subprocess.Popen(
            [FFMPEG, "-hide_banner", "-loglevel", "error", "-i", "pipe:0",
             "-vn", "-b:a", f"{bitrate}k", "-f", "mp3", "pipe:1"],
            stdin=yt.stdout, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        )
        yt.stdout.close()
        source, procs = conv.stdout, (conv, yt)
    else:  # m4a — passthrough, no re-encode
        source, procs = yt.stdout, (yt,)

    first = source.read(65536)
    if not first:
        for p in procs:
            if p.poll() is None:
                p.kill()
        return None
    return first, source, procs


def _stream_audio(url: str, fmt_type: str, quality: str) -> StreamingResponse:
    if fmt_type == "mp3" and not HAS_FFMPEG:
        raise HTTPException(500, "ffmpeg is required for MP3 and is not installed.")
    bitrate = quality if quality in ALLOWED_MP3_BITRATE else "320"
    media_type, filename = (
        ("audio/mpeg", "grabit-audio.mp3") if fmt_type == "mp3"
        else ("audio/mp4", "grabit-audio.m4a")
    )

    slot = _Slot().__enter__()
    try:
        for extra in _youtube_attempts(url):
            started = _open_audio_pipeline(url, extra, fmt_type, bitrate)
            if started is None:
                continue
            first, source, procs = started

            def generator(first=first, source=source, procs=procs):
                try:
                    yield first
                    while True:
                        chunk = source.read(65536)
                        if not chunk:
                            break
                        yield chunk
                finally:
                    for p in procs:
                        if p.poll() is None:
                            p.kill()
                    slot.__exit__(None, None, None)

            return StreamingResponse(
                generator(),
                media_type=media_type,
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
    except Exception:
        slot.__exit__(None, None, None)
        raise

    slot.__exit__(None, None, None)
    raise HTTPException(502, "Couldn't extract audio from that link.")


def _download_video(url: str, quality: str) -> FileResponse:
    height = RES_MAP.get(re.sub(r"\D", "", quality or ""), 1080)
    fmt = (
        f"bestvideo[height<={height}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/"
        f"bestvideo[height<={height}]+bestaudio/best[height<={height}]/best"
    )
    last_err = "download failed"

    with _Slot():
        for extra in _youtube_attempts(url):
            tmpdir = tempfile.mkdtemp(prefix="grabit-")
            out = os.path.join(tmpdir, "video.mp4")
            args = [
                YTDLP, "--no-warnings", "--no-playlist", "--socket-timeout", "20",
                *extra, "-f", fmt, "--merge-output-format", "mp4", "-o", out, url,
            ]
            if HAS_FFMPEG:
                args[1:1] = ["--ffmpeg-location", FFMPEG]
            try:
                proc = subprocess.run(args, capture_output=True, text=True, timeout=600)
            except subprocess.TimeoutExpired:
                shutil.rmtree(tmpdir, ignore_errors=True)
                raise HTTPException(504, "Download timed out.")
            except FileNotFoundError:
                shutil.rmtree(tmpdir, ignore_errors=True)
                raise HTTPException(500, "yt-dlp is not installed on the server.")

            if proc.returncode == 0 and os.path.isfile(out):
                return FileResponse(
                    out,
                    media_type="video/mp4",
                    filename="grabit-video.mp4",
                    background=BackgroundTask(shutil.rmtree, tmpdir, True),
                )
            shutil.rmtree(tmpdir, ignore_errors=True)
            last_err = proc.stderr or last_err

    code, detail = friendly_error(last_err, detect_platform(url))
    raise HTTPException(code, detail)


@api_router.get("/download")
def download(
    request: Request,
    url: str = Query(...),
    type: str = Query("mp4"),
    quality: str = Query(""),
):
    if not is_safe_url(url):
        raise HTTPException(400, "Please provide a valid public http(s) link.")
    if type not in ALLOWED_TYPES:
        raise HTTPException(400, "type must be one of: mp4, mp3, m4a")
    rate_limit(_client_ip(request), limit=8)

    if type in ("mp3", "m4a"):
        return _stream_audio(url, type, quality)
    return _download_video(url, quality)


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(payload: StatusCheckCreate):
    if db is None:
        raise HTTPException(503, "Status checks are disabled (no MONGO_URL configured).")
    status_obj = StatusCheck(**payload.model_dump())
    doc = status_obj.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    if db is None:
        raise HTTPException(503, "Status checks are disabled (no MONGO_URL configured).")
    checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in checks:
        if isinstance(check.get("timestamp"), str):
            check["timestamp"] = datetime.fromisoformat(check["timestamp"])
    return checks


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve the built React app (single-process hosting) ──────────────────────
BUILD_DIR = ROOT_DIR.parent / "frontend" / "build"
if BUILD_DIR.is_dir():
    _static_dir = BUILD_DIR / "static"
    if _static_dir.is_dir():
        app.mount("/static", StaticFiles(directory=_static_dir), name="static")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        candidate = BUILD_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(BUILD_DIR / "index.html")

    logger.info(f"Serving frontend from {BUILD_DIR}")


@app.on_event("shutdown")
async def shutdown_db_client():
    if mongo_client is not None:
        mongo_client.close()
