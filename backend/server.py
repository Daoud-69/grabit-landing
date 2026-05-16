from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import httpx


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ----- Models -----
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class PreviewRequest(BaseModel):
    url: str


class PreviewResponse(BaseModel):
    platform: str  # youtube | tiktok | instagram | facebook | x | unknown
    title: Optional[str] = None
    thumbnail: Optional[str] = None
    author: Optional[str] = None
    duration: Optional[str] = None
    provider_name: Optional[str] = None
    original_url: str
    supported: bool = True


# ----- Platform detection -----
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


async def fetch_oembed(oembed_url: str) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as http:
            r = await http.get(
                oembed_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
                    "Accept": "application/json,text/javascript,*/*",
                },
            )
            if r.status_code == 200:
                try:
                    return r.json()
                except Exception:
                    return None
    except Exception as e:
        logger.warning(f"oEmbed fetch failed for {oembed_url}: {e}")
    return None


def extract_youtube_id(url: str) -> Optional[str]:
    m = re.search(r"(?:v=|youtu\.be/|/embed/|/shorts/)([A-Za-z0-9_-]{11})", url)
    return m.group(1) if m else None


# ----- Routes -----
@api_router.get("/")
async def root():
    return {"message": "Grabit API alive"}


@api_router.post("/preview", response_model=PreviewResponse)
async def preview(req: PreviewRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL required")

    platform = detect_platform(url)

    if platform == "youtube":
        data = await fetch_oembed(
            f"https://www.youtube.com/oembed?url={url}&format=json"
        )
        if data:
            return PreviewResponse(
                platform=platform,
                title=data.get("title"),
                thumbnail=data.get("thumbnail_url"),
                author=data.get("author_name"),
                provider_name=data.get("provider_name"),
                original_url=url,
            )
        # Fallback: build a thumbnail from YouTube ID if oEmbed fails
        vid = extract_youtube_id(url)
        if vid:
            return PreviewResponse(
                platform=platform,
                title="YouTube Video",
                thumbnail=f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                author="YouTube",
                provider_name="YouTube",
                original_url=url,
            )

    if platform == "tiktok":
        data = await fetch_oembed(
            f"https://www.tiktok.com/oembed?url={url}"
        )
        if data:
            return PreviewResponse(
                platform=platform,
                title=data.get("title"),
                thumbnail=data.get("thumbnail_url"),
                author=data.get("author_name"),
                provider_name=data.get("provider_name", "TikTok"),
                original_url=url,
            )

    if platform == "x":
        data = await fetch_oembed(
            f"https://publish.twitter.com/oembed?url={url}&omit_script=true"
        )
        if data:
            return PreviewResponse(
                platform=platform,
                title=(data.get("html") or "").strip()[:140] or "Post on X",
                thumbnail=None,
                author=data.get("author_name"),
                provider_name=data.get("provider_name", "X"),
                original_url=url,
            )
        # Even without oEmbed metadata, we know it's X
        return PreviewResponse(
            platform=platform,
            title="Post on X",
            thumbnail=None,
            author=None,
            provider_name="X",
            original_url=url,
            supported=True,
        )

    # Instagram & Facebook require app tokens for oEmbed — return platform detect only
    if platform in ("instagram", "facebook"):
        return PreviewResponse(
            platform=platform,
            title=f"{platform.capitalize()} content",
            thumbnail=None,
            author=None,
            provider_name=platform.capitalize(),
            original_url=url,
            supported=True,
        )

    # YouTube/TikTok detected but oEmbed failed (private/removed/invalid) — still useful
    if platform in ("youtube", "tiktok"):
        return PreviewResponse(
            platform=platform,
            title=f"{platform.capitalize()} content",
            thumbnail=None,
            author=None,
            provider_name=platform.capitalize(),
            original_url=url,
            supported=True,
        )

    # Unknown / generic
    return PreviewResponse(
        platform=platform,
        title=None,
        thumbnail=None,
        author=None,
        provider_name=None,
        original_url=url,
        supported=False,
    )


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
