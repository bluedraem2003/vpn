#!/usr/bin/env bash
set -euo pipefail
API="${API:-http://127.0.0.1:8787}"

echo "== health =="
curl -sf "$API/api/health" | tee /tmp/py-health.json
echo

echo "== login =="
LOGIN=$(curl -sf -X POST "$API/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"owner@postyar.local"}')
TOKEN=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['token'])" "$LOGIN")
WID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['workspaceId'])" "$LOGIN")
AUTH="Authorization: Bearer $TOKEN"
echo "workspace=$WID"

echo "== unauthorized content =="
code=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/content?workspaceId=$WID")
test "$code" = "401"

echo "== create project/campaign/idea/content =="
PRJ=$(curl -sf -X POST "$API/api/projects" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"workspaceId\":\"$WID\",\"name\":\"Project A\",\"clientName\":\"Client A\"}")
PID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['item']['id'])" "$PRJ")

CMP=$(curl -sf -X POST "$API/api/campaigns" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"workspaceId\":\"$WID\",\"name\":\"Summer\",\"projectId\":\"$PID\",\"platforms\":[\"instagram\"]}")
CID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['item']['id'])" "$CMP")

IDEA=$(curl -sf -X POST "$API/api/ideas" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"workspaceId\":\"$WID\",\"title\":\"ایده تست\",\"contentType\":\"reel\"}")
IID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['item']['id'])" "$IDEA")
CONV=$(curl -sf -X POST "$API/api/ideas/$IID/convert" -H "$AUTH")
CONTENT_ID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['contentId'])" "$CONV")

echo "== webhook + attach =="
UNIQ="uniq_smoke_$(date +%s)_$RANDOM"
ASSET=$(curl -sf -X POST "$API/api/telegram/webhook" -H 'Content-Type: application/json' \
  -d "{\"channel_post\":{\"message_id\":99,\"chat\":{\"id\":-1001},\"photo\":[{\"file_id\":\"F\",\"file_unique_id\":\"$UNIQ\",\"width\":10,\"height\":10,\"file_size\":10}]}}")
AID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['assetId'])" "$ASSET")
curl -sf -X POST "$API/api/assets/$AID/attach" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"contentId\":\"$CONTENT_ID\",\"role\":\"cover\"}" >/dev/null

echo "== duplicate ignored =="
DUP=$(curl -sf -X POST "$API/api/telegram/webhook" -H 'Content-Type: application/json' \
  -d "{\"channel_post\":{\"message_id\":100,\"chat\":{\"id\":-1001},\"photo\":[{\"file_id\":\"F\",\"file_unique_id\":\"$UNIQ\",\"width\":10,\"height\":10}]}}")
python3 -c "import json,sys; d=json.loads(sys.argv[1]); assert d.get('duplicate') is True and d.get('assetId')" "$DUP"

echo "== search + team =="
curl -sfG "$API/api/search" -H "$AUTH" --data-urlencode "workspaceId=$WID" --data-urlencode "q=test" >/dev/null
curl -sf "$API/api/team" -H "$AUTH" >/dev/null
curl -sf "$API/api/content/$CONTENT_ID/assets" -H "$AUTH" >/dev/null

echo "SMOKE OK"
