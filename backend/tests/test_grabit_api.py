"""Backend tests for Grabit preview API"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL') or "https://extraction-lab-1.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ----- Health -----
def test_root_alive(session):
    r = session.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("message") == "Grabit API alive"


# ----- Preview: YouTube -----
def test_preview_youtube_returns_metadata(session):
    r = session.post(f"{API}/preview", json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["platform"] == "youtube"
    assert data["title"] is not None and len(data["title"]) > 0
    assert data["thumbnail"] is not None and data["thumbnail"].startswith("http")
    assert data["author"] is not None and len(data["author"]) > 0
    assert data["supported"] is True


# ----- Preview: TikTok -----
def test_preview_tiktok(session):
    # public TikTok URL
    r = session.post(f"{API}/preview", json={"url": "https://www.tiktok.com/@tiktok/video/7106594312292453675"}, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["platform"] == "tiktok"
    assert data["supported"] is True


# ----- Preview: Instagram -----
def test_preview_instagram_platform_only(session):
    r = session.post(f"{API}/preview", json={"url": "https://www.instagram.com/p/CxYZAbcDe/"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["platform"] == "instagram"
    assert data["supported"] is True


# ----- Preview: Facebook -----
def test_preview_facebook_platform_only(session):
    r = session.post(f"{API}/preview", json={"url": "https://www.facebook.com/watch/?v=10153231379946729"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["platform"] == "facebook"
    assert data["supported"] is True


# ----- Preview: X / Twitter -----
def test_preview_x(session):
    r = session.post(f"{API}/preview", json={"url": "https://x.com/elonmusk/status/1234567890"}, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["platform"] == "x"
    assert data["supported"] is True


# ----- Preview: Unknown -----
def test_preview_unknown(session):
    r = session.post(f"{API}/preview", json={"url": "https://example.com/some-page"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["platform"] == "unknown"


# ----- Preview: empty URL -----
def test_preview_empty_url_returns_400(session):
    r = session.post(f"{API}/preview", json={"url": ""}, timeout=10)
    assert r.status_code == 400
