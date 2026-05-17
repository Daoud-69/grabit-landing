#!/bin/bash
# Double-click this file to start Grabit and get your public link.
cd "$HOME/grabit/backend" || exit 1

echo "Starting Grabit..."
pkill -f "uvicorn server:app" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
pkill -x caffeinate 2>/dev/null
sleep 1

nohup .venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8000 \
  > "$HOME/grabit/server.log" 2>&1 &
sleep 4

nohup cloudflared tunnel --url http://localhost:8000 \
  > "$HOME/grabit/tunnel.log" 2>&1 &

# Keep the Mac awake so the site stays up while the lid is open.
nohup caffeinate -dimsu > /dev/null 2>&1 &

printf "Getting your public link"
URL=""
for i in $(seq 1 20); do
  sleep 1
  printf "."
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$HOME/grabit/tunnel.log" | head -1)
  [ -n "$URL" ] && break
done
echo ""
echo ""
if [ -n "$URL" ]; then
  echo "  ================================================"
  echo "   Grabit is running!"
  echo ""
  echo "   On this Mac:     http://localhost:8000"
  echo "   On any device:   $URL"
  echo ""
  echo "   When it asks you to log in:"
  echo "     username:  grabit"
  echo "     password:  grabitvault2649"
  echo "  ================================================"
else
  echo "  Started, but couldn't read the public link."
  echo "  On this Mac it still works: http://localhost:8000"
  echo "  Login -> username: grabit   password: grabitvault2649"
fi
echo ""
echo "  Keep your Mac's lid OPEN (the screen may turn dark — that's fine)."
echo "  If you CLOSE the lid, the Mac sleeps and the website goes down."
echo ""
echo "  (You can close this window — Grabit keeps running.)"
