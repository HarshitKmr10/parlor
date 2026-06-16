#!/usr/bin/env bash
# =============================================================================
# Botless (desktop-capture) end-to-end smoke test for the Verdant stack.
# =============================================================================
# Proves the BOTLESS path against the running docker-compose stack — the flow
# the desktop-capture client drives, with NO bot joining a call and NO psql
# shim seeding the transcript (segments land via the public ingest endpoint):
#
#   1. POST /api/v1/auth/signup                 -> accessToken + workspaceId
#   2. POST /api/v1/meetings/botless            -> botless meetingId
#                                                  (platform=desktop, ongoing)
#   3. POST /api/v1/meetings/{id}/transcript    -> append a few TranscriptSegments
#                                                  (the real server-side ingest)
#   4. GET  /api/v1/meetings/{id}/transcript    -> assert the segments come back
#      GET  .../transcript?since=<lastSegmentAt> -> assert the cursor works
#   5. POST ai-service /embed                   -> seed pgvector for RAG
#                                                  (TEST SHIM: the bot/capture
#                                                   pipeline embeds during a real
#                                                   run; ai-service is mocked here)
#   6. POST /api/v1/meetings/{id}/complete      -> ongoing -> completed
#   7. POST /api/v1/meetings/{id}/summarize     -> MeetingInsights
#   8. POST /api/v1/meetings/{id}/ask           -> { answer, citations[] }
#
# Each step asserts HTTP status + key response fields. Exits non-zero on any
# failure and prints a PASS/FAIL summary.
#
# Requires: bash, curl, jq, docker (compose). Reads ports from ./.env.
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a; source ./.env; set +a
fi

API_PORT="${API_PORT:-8001}"
AI_PORT="${AI_PORT:-8101}"

API="http://localhost:${API_PORT}/api/v1"
AI="http://localhost:${AI_PORT}"

PASS=0; FAIL=0
green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
step()  { printf "\n\033[1m== %s\033[0m\n" "$1"; }
ok()   { green "  PASS: $1"; PASS=$((PASS+1)); }
bad()  { red   "  FAIL: $1"; FAIL=$((FAIL+1)); }
assert_eq() {
  if [[ "$1" == "$2" ]]; then ok "$3 (=$2)"; else bad "$3 (expected '$1', got '$2')"; fi
}
assert_nonempty() {
  if [[ -n "$1" && "$1" != "null" ]]; then ok "$2"; else bad "$2 (empty/null)"; fi
}

STAMP="$(date +%s)$RANDOM"
EMAIL="botless+${STAMP}@example.com"

echo "Target backend : ${API}"
echo "Target ai-svc  : ${AI}"

# ── Step 1: signup ───────────────────────────────────────────────────────────
step "1. POST /auth/signup"
SIGNUP_BODY=$(jq -n --arg e "$EMAIL" \
  '{email:$e, password:"botless-pass-123", name:"Botless Tester", workspaceName:"Botless Workspace"}')
RESP=$(curl -sS -w $'\n%{http_code}' -X POST "${API}/auth/signup" \
  -H 'Content-Type: application/json' -d "$SIGNUP_BODY")
HTTP=$(tail -n1 <<<"$RESP"); JSON=$(sed '$d' <<<"$RESP")
assert_eq "201" "$HTTP" "signup HTTP status"
TOKEN=$(jq -r '.accessToken // empty' <<<"$JSON")
WS_ID=$(jq -r '.workspace.id // empty' <<<"$JSON")
assert_nonempty "$TOKEN" "signup returned accessToken"
assert_nonempty "$WS_ID" "signup returned workspace.id"
if [[ -z "$TOKEN" || -z "$WS_ID" ]]; then
  red "Cannot continue without token + workspace id."; printf "  body: %s\n" "$JSON"
  echo; red "BOTLESS SMOKE FAILED"; exit 1
fi
AUTH=(-H "Authorization: Bearer ${TOKEN}" -H "X-Workspace-Id: ${WS_ID}")

# ── Step 2: create botless meeting ───────────────────────────────────────────
step "2. POST /meetings/botless  (no bot dispatch)"
RESP=$(curl -sS -w $'\n%{http_code}' -X POST "${API}/meetings/botless" \
  "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "$(jq -n '{title:"Botless Q3 Sync", source:"desktop"}')")
HTTP=$(tail -n1 <<<"$RESP"); JSON=$(sed '$d' <<<"$RESP")
assert_eq "201" "$HTTP" "botless-create HTTP status"
MEETING_ID=$(jq -r '.id // empty' <<<"$JSON")
PLATFORM=$(jq -r '.platform // empty' <<<"$JSON")
STATUS=$(jq -r '.status // empty' <<<"$JSON")
MEETING_URL=$(jq -r '.meetingUrl // empty' <<<"$JSON")
assert_nonempty "$MEETING_ID" "botless-create returned id"
assert_eq "desktop" "$PLATFORM" "botless-create platform=desktop"
assert_eq "ongoing" "$STATUS" "botless-create status=ongoing"
case "$MEETING_URL" in
  desktop://*) ok "botless-create synthetic url ($MEETING_URL)";;
  *) bad "botless-create url not desktop:// ($MEETING_URL)";;
esac
if [[ -z "$MEETING_ID" ]]; then
  red "Cannot continue without a meeting id."; printf "  body: %s\n" "$JSON"
  echo; red "BOTLESS SMOKE FAILED"; exit 1
fi

# ── Step 3: ingest transcript segments (the real server-side path) ───────────
step "3. POST /meetings/{id}/transcript  (server-side ingest, no psql shim)"
INGEST_BODY=$(cat <<'JSON'
{
  "segments": [
    {"id":"seg-1","speakerId":"u-alice","speakerName":"Alice","text":"Welcome everyone. Today we are planning the Q3 roadmap and the migration to the new billing system.","tStartSec":0,"tEndSec":12,"createdAt":"2026-06-16T10:00:00Z"},
    {"id":"seg-2","speakerId":"u-bob","speakerName":"Bob","text":"The billing migration is the top priority. I will own the database cutover and we need to finish it by next Friday.","tStartSec":12,"tEndSec":30,"createdAt":"2026-06-16T10:00:12Z"},
    {"id":"seg-3","speakerId":"u-carol","speakerName":"Carol","text":"For the roadmap, the three Q3 milestones are billing migration, the analytics dashboard, and the mobile onboarding flow.","tStartSec":30,"tEndSec":52,"createdAt":"2026-06-16T10:00:30Z"},
    {"id":"seg-4","speakerId":"u-alice","speakerName":"Alice","text":"Great. Action item: Bob will lead the billing migration, Carol will follow up on the analytics dashboard design.","tStartSec":52,"tEndSec":74,"createdAt":"2026-06-16T10:00:52Z"},
    {"id":"seg-5","speakerId":"u-bob","speakerName":"Bob","text":"Agreed. Lets reconvene next week to review migration progress before the Friday deadline.","tStartSec":74,"tEndSec":92,"createdAt":"2026-06-16T10:01:14Z"}
  ]
}
JSON
)
RESP=$(curl -sS -w $'\n%{http_code}' -X POST "${API}/meetings/${MEETING_ID}/transcript" \
  "${AUTH[@]}" -H 'Content-Type: application/json' -d "$INGEST_BODY")
HTTP=$(tail -n1 <<<"$RESP"); JSON=$(sed '$d' <<<"$RESP")
assert_eq "200" "$HTTP" "ingest HTTP status"
APPENDED=$(jq -r '.appended // 0' <<<"$JSON")
LAST_AT=$(jq -r '.lastSegmentAt // empty' <<<"$JSON")
if [[ "$APPENDED" -eq 5 ]]; then ok "ingest appended 5 segments"; else bad "ingest appended $APPENDED (expected 5)"; fi
assert_nonempty "$LAST_AT" "ingest returned lastSegmentAt"

# ── Step 4: read transcript back + verify since cursor ───────────────────────
step "4. GET /meetings/{id}/transcript  (+ since cursor)"
RESP=$(curl -sS -w $'\n%{http_code}' -X GET "${API}/meetings/${MEETING_ID}/transcript" "${AUTH[@]}")
HTTP=$(tail -n1 <<<"$RESP"); JSON=$(sed '$d' <<<"$RESP")
assert_eq "200" "$HTTP" "get-transcript HTTP status"
ITEMS_N=$(jq -r '(.items // []) | length' <<<"$JSON")
FIRST_TEXT=$(jq -r '(.items // [])[0].text // empty' <<<"$JSON")
if [[ "$ITEMS_N" -eq 5 ]]; then ok "get-transcript returned 5 segments"; else bad "get-transcript returned $ITEMS_N (expected 5)"; fi
assert_nonempty "$FIRST_TEXT" "get-transcript first segment has text"

# Half-way cursor: segments after seg-2's timestamp should be 3.
RESP=$(curl -sS -w $'\n%{http_code}' -G "${API}/meetings/${MEETING_ID}/transcript" \
  "${AUTH[@]}" --data-urlencode "since=2026-06-16T10:00:12Z")
JSON=$(sed '$d' <<<"$RESP")
SINCE_N=$(jq -r '(.items // []) | length' <<<"$JSON")
if [[ "$SINCE_N" -eq 3 ]]; then ok "since cursor returned 3 newer segments"; else bad "since cursor returned $SINCE_N (expected 3)"; fi

# ── Step 5: seed embeddings via ai-service /embed (test shim) ────────────────
step "5. POST ai-service /embed  (seed pgvector — test shim for capture-time embed)"
EMBED_BODY=$(jq -n --arg ws "$WS_ID" --arg m "$MEETING_ID" '{
  workspaceId: $ws, meetingId: $m,
  segments: [
    {id:"seg-1", speakerId:"u-alice", speakerName:"Alice", text:"Welcome everyone. Today we are planning the Q3 roadmap and the migration to the new billing system.", tStartSec:0,  tEndSec:12},
    {id:"seg-2", speakerId:"u-bob",   speakerName:"Bob",   text:"The billing migration is the top priority. I will own the database cutover and we need to finish it by next Friday.", tStartSec:12, tEndSec:30},
    {id:"seg-3", speakerId:"u-carol", speakerName:"Carol", text:"For the roadmap, the three Q3 milestones are billing migration, the analytics dashboard, and the mobile onboarding flow.", tStartSec:30, tEndSec:52},
    {id:"seg-4", speakerId:"u-alice", speakerName:"Alice", text:"Great. Action item: Bob will lead the billing migration, Carol will follow up on the analytics dashboard design.", tStartSec:52, tEndSec:74},
    {id:"seg-5", speakerId:"u-bob",   speakerName:"Bob",   text:"Agreed. Lets reconvene next week to review migration progress before the Friday deadline.", tStartSec:74, tEndSec:92}
  ]
}')
RESP=$(curl -sS -w $'\n%{http_code}' -X POST "${AI}/embed" \
  -H 'Content-Type: application/json' -d "$EMBED_BODY")
HTTP=$(tail -n1 <<<"$RESP"); JSON=$(sed '$d' <<<"$RESP")
assert_eq "200" "$HTTP" "embed HTTP status"
EMBEDDED_N=$(jq -r '.embedded // 0' <<<"$JSON")
if [[ "$EMBEDDED_N" -ge 5 ]]; then ok "embed wrote $EMBEDDED_N segments to pgvector"; else bad "embed wrote too few segments ($EMBEDDED_N)"; fi

# ── Step 6: complete the meeting (ongoing -> completed) ──────────────────────
step "6. POST /meetings/{id}/complete  (ongoing -> completed, fires AI pipeline)"
RESP=$(curl -sS -w $'\n%{http_code}' -X POST "${API}/meetings/${MEETING_ID}/complete" "${AUTH[@]}")
HTTP=$(tail -n1 <<<"$RESP"); JSON=$(sed '$d' <<<"$RESP")
assert_eq "200" "$HTTP" "complete HTTP status"
COMPLETED_STATUS=$(jq -r '.status // empty' <<<"$JSON")
assert_eq "completed" "$COMPLETED_STATUS" "complete transitioned status=completed"

# ── Step 7: summarize ────────────────────────────────────────────────────────
step "7. POST /meetings/{id}/summarize  (backend -> ai-service /summarize)"
RESP=$(curl -sS -w $'\n%{http_code}' -X POST "${API}/meetings/${MEETING_ID}/summarize" \
  "${AUTH[@]}" -H 'Content-Type: application/json')
HTTP=$(tail -n1 <<<"$RESP"); JSON=$(sed '$d' <<<"$RESP")
assert_eq "200" "$HTTP" "summarize HTTP status"
SUMMARY=$(jq -r '.summary // empty' <<<"$JSON")
KEYPOINTS_N=$(jq -r '(.keyPoints // []) | length' <<<"$JSON")
ACTIONS_N=$(jq -r '(.actionItems // []) | length' <<<"$JSON")
assert_nonempty "$SUMMARY" "summarize returned a summary"
if [[ "$KEYPOINTS_N" -ge 1 ]]; then ok "summarize returned keyPoints ($KEYPOINTS_N)"; else bad "summarize keyPoints empty"; fi
if [[ "$ACTIONS_N" -ge 1 ]]; then ok "summarize returned actionItems ($ACTIONS_N)"; else bad "summarize actionItems empty"; fi
echo "  summary: ${SUMMARY:0:160}"

# ── Step 8: ask ──────────────────────────────────────────────────────────────
step "8. POST /meetings/{id}/ask  (backend -> ai-service /chat -> pgvector RAG)"
ASK_BODY=$(jq -n '{question:"What are the three Q3 milestones and who owns the billing migration?"}')
RESP=$(curl -sS -w $'\n%{http_code}' -X POST "${API}/meetings/${MEETING_ID}/ask" \
  "${AUTH[@]}" -H 'Content-Type: application/json' -d "$ASK_BODY")
HTTP=$(tail -n1 <<<"$RESP"); JSON=$(sed '$d' <<<"$RESP")
assert_eq "200" "$HTTP" "ask HTTP status"
ANSWER=$(jq -r '.answer // empty' <<<"$JSON")
CIT_N=$(jq -r '(.citations // []) | length' <<<"$JSON")
assert_nonempty "$ANSWER" "ask returned an answer"
if [[ "$CIT_N" -ge 1 ]]; then ok "ask returned citations ($CIT_N) from pgvector retrieval"; else bad "ask returned NO citations"; fi
echo "  answer:   ${ANSWER:0:200}"
echo "  citation: $(jq -rc '(.citations // [])[0] // {}' <<<"$JSON")"

# ── Summary ──────────────────────────────────────────────────────────────────
step "SUMMARY"
echo "  passed: $PASS    failed: $FAIL"
if [[ "$FAIL" -eq 0 ]]; then
  green "BOTLESS SMOKE PASSED — desktop-capture path lands segments + summarize + ask end-to-end."
  exit 0
else
  red "BOTLESS SMOKE FAILED — $FAIL assertion(s) failed."
  exit 1
fi
