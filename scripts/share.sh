#!/usr/bin/env bash
# Build production app, expose via Cloudflare quick tunnel, refresh Telegram webhook.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-8080}"
export PORT
export HOST=0.0.0.0
export NODE_ENV=production
export SHARE_INVITE_LINKS=1
export ALLOW_DEV_LOGIN="${ALLOW_DEV_LOGIN:-1}"
export DATABASE_PATH="${DATABASE_PATH:-/workspace/data/postyar.sqlite}"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and fill Telegram/auth values."
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

echo "==> Building frontend..."
npm run build

echo "==> Stopping previous PostYar prod / tunnel if any..."
pkill -f "tsx server/src/index.ts" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://127.0.0.1:${PORT}" 2>/dev/null || true
sleep 1

echo "==> Starting production server on :${PORT}"
nohup npm run start > /tmp/postyar-prod.log 2>&1 &
PROD_PID=$!
sleep 2
curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null

echo "==> Starting Cloudflare tunnel..."
rm -f /tmp/postyar-tunnel.log
nohup npx --yes cloudflared tunnel --url "http://127.0.0.1:${PORT}" > /tmp/postyar-tunnel.log 2>&1 &
TUNNEL_PID=$!

PUBLIC_URL=""
for _ in $(seq 1 40); do
  PUBLIC_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/postyar-tunnel.log | head -1 || true)
  if [[ -n "$PUBLIC_URL" ]]; then break; fi
  sleep 1
done

if [[ -z "$PUBLIC_URL" ]]; then
  echo "Tunnel URL not found. See /tmp/postyar-tunnel.log"
  exit 1
fi

# Persist public URL for magic/invite links
python3 - <<PY
from pathlib import Path
p = Path('.env')
text = p.read_text()
lines = []
found = False
for line in text.splitlines():
    if line.startswith('AUTH_PUBLIC_URL='):
        lines.append('AUTH_PUBLIC_URL=${PUBLIC_URL}')
        found = True
    else:
        lines.append(line)
if not found:
    lines.append('AUTH_PUBLIC_URL=${PUBLIC_URL}')
p.write_text('\n'.join(lines) + '\n')
print('AUTH_PUBLIC_URL updated')
PY

# Restart prod so AUTH_PUBLIC_URL reloads
kill "$PROD_PID" 2>/dev/null || true
sleep 1
export AUTH_PUBLIC_URL="$PUBLIC_URL"
nohup npm run start > /tmp/postyar-prod.log 2>&1 &
sleep 2
curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null

if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_WEBHOOK_SECRET:-}" ]]; then
  echo "==> Setting Telegram webhook..."
  curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
    -d "url=${PUBLIC_URL}/api/telegram/webhook" \
    -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
    -d "allowed_updates=[\"message\",\"channel_post\",\"my_chat_member\"]" | python3 -m json.tool
fi

cat <<EOF

========================================
پست‌یار آماده اشتراک با هم‌تیمی است

URL:  ${PUBLIC_URL}
Health: ${PUBLIC_URL}/api/health

۱) وارد شوید (ورود سریع یا Magic Link)
۲) صفحه «تیم» → دعوت همکار با ایمیل
۳) لینک دعوت را کپی کنید و برای همکار بفرستید

برای استقرار دائمی روی سرور خودتان:
  docker compose up -d --build
  # یا: docker pull ghcr.io/<owner>/postyar:latest

Logs: /tmp/postyar-prod.log  /tmp/postyar-tunnel.log
========================================
EOF
