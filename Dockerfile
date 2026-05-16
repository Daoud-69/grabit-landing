# ── Stage 1: build the React frontend ──────────────────────────────────────
FROM node:20-slim AS frontend
WORKDIR /app/frontend
# Use yarn via corepack — yarn 1's flat install avoids the ajv/ajv-keywords
# resolution conflict that breaks the CRA build under npm.
RUN corepack enable
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY frontend/ ./
# The frontend talks to /api on the same origin it is served from.
# CI=false keeps ESLint warnings from failing the production build.
ENV REACT_APP_BACKEND_URL="" \
    GENERATE_SOURCEMAP="false" \
    CI="false"
RUN yarn build

# ── Stage 2: Python backend + ffmpeg, also serving the built frontend ───────
FROM python:3.12-slim AS app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/
COPY --from=frontend /app/frontend/build ./frontend/build
ENV PORT=8000
EXPOSE 8000
WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
