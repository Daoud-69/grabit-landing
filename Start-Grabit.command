#!/bin/bash
# Double-click this file to start Grabit.
cd "$HOME/grabit/backend" || exit 1

TUNNEL_TOKEN="eyJhIjoiNWYzYTUwYzc0MDA1NmE5ODk4ZWNkYjM5MzkzYTc4ZjEiLCJ0IjoiMTM5YTVjN2MtOGUyZi00NGZlLWI5YTEtZTlkNmVjN2RjNDllIiwicyI6Ik9HSmhOemhtWW1FdE56WmpPUzAwTURrNExXSmpNV0l0T1Roa1kySmtOamxsTjJSbSJ9"

echo "Starting Grabit..."
pkill -f "uvicorn server:app" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
pkill -x caffeinate 2>/dev/null
sleep 1

nohup .venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8000 \
  > "$HOME/grabit/server.log" 2>&1 &
sleep 4

nohup cloudflared tunnel run --protocol http2 --token "$TUNNEL_TOKEN" \
  > "$HOME/grabit/tunnel.log" 2>&1 &

# Keep the Mac awake so the site stays up while the lid is open.
nohup caffeinate -dimsu > /dev/null 2>&1 &

echo ""
echo "  ================================================"
echo "   Grabit is running!"
echo ""
echo "   On this Mac:     http://localhost:8000"
echo "   On any device:   https://gr4bit.com"
echo ""
echo "   When it asks you to log in:"
echo "     username:  grabit"
echo "     password:  grabitvault2649"
echo "  ================================================"
echo ""
echo "  Keep your Mac's lid OPEN (the screen may turn dark — that's fine)."
echo "  If you CLOSE the lid, the Mac sleeps and the website goes down."
echo ""
echo "  (You can close this window — Grabit keeps running.)"
