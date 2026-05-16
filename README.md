# Grabit

Save videos and audio from YouTube, TikTok, X, Instagram and Facebook.
Paste a link, see a live preview, then download it as an MP4 (your choice of
quality) or extract the audio as MP3 — no watermarks, no ads, no sign-up.

- **Frontend** — React (CRA + Tailwind), high-contrast dark "hardware" UI.
- **Backend** — FastAPI + [`yt-dlp`](https://github.com/yt-dlp/yt-dlp), streams
  real downloads. `ffmpeg` is used for MP3 extraction and MP4 merging.

## Run with Docker (recommended)

Builds the frontend, bundles `ffmpeg` + `yt-dlp`, and serves the whole app
from one container.

```bash
docker build -t grabit .
docker run -p 8000:8000 grabit
```

Open http://localhost:8000.

## Run locally

Requires Python 3.10+, Node 18+, and `ffmpeg` on your `PATH`
(`brew install ffmpeg` / `apt install ffmpeg`).

**Backend**

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

**Frontend** (separate terminal)

```bash
cd frontend
echo "REACT_APP_BACKEND_URL=http://localhost:8000" > .env
yarn install && yarn start
```

## API

| Method | Route           | Purpose                                            |
|--------|-----------------|----------------------------------------------------|
| GET    | `/api/health`   | yt-dlp / ffmpeg / mongo availability               |
| POST   | `/api/preview`  | `{ "url": "..." }` → title, thumbnail, formats     |
| GET    | `/api/download` | `?url=&type=mp4\|mp3\|m4a&quality=` → streams file |

## Environment variables

All are optional:

| Variable       | Default  | Purpose                                            |
|----------------|----------|----------------------------------------------------|
| `PORT`         | `8000`   | Port the server listens on.                        |
| `CORS_ORIGINS` | `*`      | Comma-separated allowed origins.                   |
| `MONGO_URL`    | —        | Enables the legacy `/api/status` endpoints if set. |
| `DB_NAME`      | `grabit` | Mongo database name (only used with `MONGO_URL`).  |

> Some platforms (Instagram, parts of Facebook/X) require a logged-in session.
> Public content works without any configuration.
