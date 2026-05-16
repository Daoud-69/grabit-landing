"""Backend tests for the Grabit API.

These hit the network (the real yt-dlp pipeline), so they need outbound
access and a running server. Point them at a server with:

    REACT_APP_BACKEND_URL=http://localhost:8000 pytest backend/tests
"""
import os
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"

# A stable, public, Creative-Commons YouTube video.
SAMPLE_VIDEO = "https://www.youtube.com/watch?v=aqz-KE-bpKQ"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_root_alive(session):
    r = session.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("message") == "Grabit API alive"


def test_health(session):
    r = session.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["ytdlp"], "yt-dlp must be installed"


def test_preview_youtube_returns_metadata(session):
    r = session.post(f"{API}/preview", json={"url": SAMPLE_VIDEO}, timeout=60)
    assert r.status_code == 200
    data = r.json()
    assert data["platform"] == "youtube"
    assert data["supported"] is True
    assert data["title"]
    assert data["thumbnail"] and data["thumbnail"].startswith("http")
    assert isinstance(data["available_resolutions"], list)
    assert data["available_resolutions"], "should expose at least one resolution"


def test_preview_empty_url_returns_400(session):
    r = session.post(f"{API}/preview", json={"url": ""}, timeout=10)
    assert r.status_code == 400


def test_preview_rejects_private_host(session):
    # SSRF guard — internal addresses must never be fetched.
    r = session.post(f"{API}/preview", json={"url": "http://169.254.169.254/"}, timeout=10)
    assert r.status_code == 400


def test_preview_non_media_url_errors(session):
    # A real backend cannot extract media from a plain web page.
    r = session.post(f"{API}/preview", json={"url": "https://example.com/"}, timeout=30)
    assert r.status_code >= 400


def test_download_validates_type(session):
    r = session.get(
        f"{API}/download",
        params={"url": SAMPLE_VIDEO, "type": "exe"},
        timeout=10,
    )
    assert r.status_code == 400


def test_download_mp4_streams_a_file(session):
    r = session.get(
        f"{API}/download",
        params={"url": SAMPLE_VIDEO, "type": "mp4", "quality": "360"},
        timeout=300,
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "video/mp4"
    assert len(r.content) > 10_000
