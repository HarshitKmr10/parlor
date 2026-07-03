#!/usr/bin/env bash
# =============================================================================
# End-to-end cross-service smoke test for the Parlor meeting-assistant stack.
# =============================================================================
# Proves the FULL flow against the running docker-compose stack:
#
#   1. POST /api/v1/auth/signup            -> accessToken + workspaceId
#   2. POST /api/v1/meetings (Meet URL)    -> meetingId
#   3. Seed a transcript into Postgres     -> TEST SHIM (stands in for a real
#                                             bot join writing meeting_joiner.transcript)
#   4. POST /api/v1/meetings/{id}/summarize -> MeetingInsights
#                                             (backend -> ai-service /summarize, mock)
#   5. Seed embeddings via ai-service /embed -> writes pgvector meeting_embeddings
#                                             (TEST SHIM: backend's bot pipeline
#                                              would normally embed during capture)
#   6. POST /api/v1/meetings/{id}/ask       -> { answer, citations[] }
#                                             (backend -> ai-service /chat -> pgvector RAG)
#
# Each step asserts HTTP status + key response fields. Exits non-zero on any
# failure and prints a PASS/FAIL summary.
#
# Requires: bash, curl, jq, docker (compose). Reads ports from ./.env.
# =============================================================================
set -uo pipefail

# ── Locate repo root + load .env ─────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a; source ./.env; set +a
fi

API_PORT="${API_PORT:-8001}"
AI_PORT="${AI_PORT:-8101}"
WEB_PORT="${WEB_PORT:-3001}"
PG_USER="${POSTGRES_USER:-meeting}"
PG_DB="${POSTGRES_DB:-meeting}"

API="http://localhost:${API_PORT}/api/v1"
AI="http://localhost:${AI_PORT}"
WEB="http://localhost:${WEB_PORT}"
COMPOSE="docker compose"

# ── Pretty output + assertion helpers ────────────────────────────────────────
PASS=0; FAIL=0
green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
step()  { printf "\n\033[1m== %s\033[0m\n" "$1"; }

ok()   { green "  PASS: $1"; PASS=$((PASS+1)); }
bad()  { red   "  FAIL: $1"; FAIL=$((FAIL+1)); }

# assert_eq <expected> <actual> <label>
assert_eq() {
  if [[ "$1" == "$2" ]]; then ok "$3 (=$2)"; else bad "$3 (expected '$1', got '$2')"; fi
}
# assert_nonempty <value> <label>
assert_nonempty() {
  if [[ -n "$1" && "$1" != "null" ]]; then ok "$2"; else bad "$2 (empty/null)"; fi
}

# Unique email so reruns don't collide on the email-taken constraint.
STAMP="$(date +%s)$RANDOM"
EMAIL="smoke+${STAMP}@example.com"
MEET_URL="https://meet.google.com/smk-${STAMP: -4}-tst"

echo "Target backend : ${API}"
echo "Target ai-svc  : ${AI}"
echo "Target web     : ${WEB}"

# ── Step 1: signup ───────────────────────────────────────────────────────────
step "1. POST /auth/signup"
SIGNUP_BODY=$(jq -n --arg e "$EMAIL" \
  '{email:$e, password:"smoke-pass-123", name:"Smoke Tester", workspaceName:"Smoke Workspace"}')
RESP=$(curl -sS -w $'\n%{http_code}' -X POST "${API}/auth/signup" \
  -H 'Content-Type: application/json' -d "$SIGNUP_BODY")
HTTP=$(tail -n1 <<<"$RESP"); JSON=$(sed '$d' <<<"$RESP")
assert_eq "201" "$HTTP" "signup HTTP status"

TOKEN=$(jq -r '.accessToken // empty' <<<"$JSON")
WS_ID=$(jq -r '.workspace.id // empty' <<<"$JSON")
USER_ID=$(jq -r '.user.id // empty' <<<"$JSON")
assert_nonempty "$TOKEN" "signup returned accessToken"
assert_nonempty "$WS_ID" "signup returned workspace.id"
assert_nonempty "$USER_ID" "signup returned user.id"

if [[ -z "$TOKEN" || -z "$WS_ID" ]]; then
  red "Cannot continue without token + workspace id."; printf "  body: %s\n" "$JSON"
  echo; red "SMOKE TEST FAILED"; exit 1
fi
AUTH=(-H "Authorization: Bearer ${TOKEN}" -H "X-Workspace-Id: ${WS_ID}")

# ── Step 2: create meeting ───────────────────────────────────────────────────
step "2. POST /meetings (Google Meet URL)"
MEETING_BODY=$(jq -n --arg u "$MEET_URL" '{meetingUrl:$u, title:"Smoke Q3 Planning", botName:"Smoke Bot"}')
RESP=$(curl -sS -w $'\n%{http_code}' -X POST "${API}/meetings" \
  "${AUTH[@]}" -H 'Content-Type: application/json' -d "$MEETING_BODY")
HTTP=$(tail -n1 <<<"$RESP"); JSON=$(sed '$d' <<<"$RESP")
assert_eq "201" "$HTTP" "create-meeting HTTP status"

MEETING_ID=$(jq -r '.id // empty' <<<"$JSON")
PLATFORM=$(jq -r '.platform // empty' <<<"$JSON")
assert_nonempty "$MEETING_ID" "create-meeting returned id"
assert_eq "meet" "$PLATFORM" "create-meeting detected platform"

if [[ -z "$MEETING_ID" ]]; then
  red "Cannot continue without a meeting id."; printf "  body: %s\n" "$JSON"
  echo; red "SMOKE TEST FAILED"; exit 1
fi

# ── Step 3: seed transcript (TEST SHIM) ──────────────────────────────────────
# A real bot join would populate meeting_joiner.transcript over a live call.
# Here we inject a handful of realistic TranscriptSegments directly via psql so
# the AI summarize/ask paths have data to work on. The backend reads the
# `content[]` array (keys: id/speaker/speakerId/text/startTime/endTime).
step "3. Seed transcript into Postgres (test shim for a real bot join)"
TRANSCRIPT_JSON=$(cat <<'JSON'
{
  "content": [
    {"id":"seg-1","speaker":"Alice","speakerId":"u-alice","text":"Welcome everyone. Today we are planning the Q3 roadmap and the migration to the new billing system.","startTime":0,"endTime":12,"timestamp":"2026-06-16T10:00:00Z","session_number":1},
    {"id":"seg-2","speaker":"Bob","speakerId":"u-bob","text":"The billing migration is the top priority. I will own the database cutover and we need to finish it by next Friday.","startTime":12,"endTime":30,"timestamp":"2026-06-16T10:00:12Z","session_number":1},
    {"id":"seg-3","speaker":"Carol","speakerId":"u-carol","text":"For the roadmap, the three Q3 milestones are billing migration, the analytics dashboard, and the mobile onboarding flow.","startTime":30,"endTime":52,"timestamp":"2026-06-16T10:00:30Z","session_number":1},
    {"id":"seg-4","speaker":"Alice","speakerId":"u-alice","text":"Great. Action item: Bob will lead the billing migration, Carol will follow up on the analytics dashboard design.","startTime":52,"endTime":74,"timestamp":"2026-06-16T10:00:52Z","session_number":1},
    {"id":"seg-5","speaker":"Bob","speakerId":"u-bob","text":"Agreed. Let's reconvene next week to review migration progress before the Friday deadline.","startTime":74,"endTime":92,"timestamp":"2026-06-16T10:01:14Z","session_number":1}
  ],
  "lastSegmentTime":"2026-06-16T10:01:14Z",
  "totalSegments":5
}
JSON
)
# Update the meeting row's transcript (scoped to this workspace + meeting id).
SEED_SQL="UPDATE meeting_joiner
          SET transcript = \$\$${TRANSCRIPT_JSON}\$\$::json,
              status = 'completed',
              updated_at = now()
          WHERE id = '${MEETING_ID}'::uuid;"
SEED_OUT=$(printf '%s' "$SEED_SQL" | $COMPOSE exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 2>&1)
SEED_RC=$?
if [[ $SEED_RC -eq 0 && "$SEED_OUT" == *"UPDATE 1"* ]]; then
  ok "seeded transcript (UPDATE 1 row)"
else
  bad "seeding transcript failed"; printf "  psql: %s\n" "$SEED_OUT"
fi

# ── Step 4: summarize (backend -> ai-service /summarize, mock) ───────────────
step "4. POST /meetings/{id}/summarize  (backend -> ai-service /summarize)"
RESP=$(curl -sS -w $'\n%{http_code}' -X POST "${API}/meetings/${MEETING_ID}/summarize" \
  "${AUTH[@]}" -H 'Content-Type: application/json')
HTTP=$(tail -n1 <<<"$RESP"); JSON=$(sed '$d' <<<"$RESP")
assert_eq "200" "$HTTP" "summarize HTTP status"

SUMMARY=$(jq -r '.summary // empty' <<<"$JSON")
KEYPOINTS_N=$(jq -r '(.keyPoints // []) | length' <<<"$JSON")
ACTIONS_N=$(jq -r '(.actionItems // []) | length' <<<"$JSON")
CHAPTERS_N=$(jq -r '(.chapters // []) | length' <<<"$JSON")
assert_nonempty "$SUMMARY" "summarize returned a summary"
if [[ "$KEYPOINTS_N" -ge 1 ]]; then ok "summarize returned keyPoints ($KEYPOINTS_N)"; else bad "summarize keyPoints empty"; fi
if [[ "$ACTIONS_N" -ge 1 ]]; then ok "summarize returned actionItems ($ACTIONS_N)"; else bad "summarize actionItems empty"; fi
if [[ "$CHAPTERS_N" -ge 1 ]]; then ok "summarize returned chapters ($CHAPTERS_N)"; else bad "summarize chapters empty"; fi
echo "  summary: ${SUMMARY:0:160}"

# ── Step 5: seed embeddings via ai-service /embed (TEST SHIM) ────────────────
# The backend ask path does NOT embed; the bot/capture pipeline would. We call
# the ai-service /embed endpoint directly with the SAME segments so pgvector has
# rows for the RAG retrieval in step 6. workspaceId + meetingId must match.
step "5. POST ai-service /embed  (seed pgvector meeting_embeddings — test shim)"
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

# ── Step 6: ask (backend -> ai-service /chat -> pgvector RAG) ────────────────
step "6. POST /meetings/{id}/ask  (backend -> ai-service /chat -> pgvector retrieval)"
ASK_BODY=$(jq -n '{question:"What are the three Q3 milestones and who owns the billing migration?"}')
RESP=$(curl -sS -w $'\n%{http_code}' -X POST "${API}/meetings/${MEETING_ID}/ask" \
  "${AUTH[@]}" -H 'Content-Type: application/json' -d "$ASK_BODY")
HTTP=$(tail -n1 <<<"$RESP"); JSON=$(sed '$d' <<<"$RESP")
assert_eq "200" "$HTTP" "ask HTTP status"
ANSWER=$(jq -r '.answer // empty' <<<"$JSON")
CIT_N=$(jq -r '(.citations // []) | length' <<<"$JSON")
assert_nonempty "$ANSWER" "ask returned an answer"
if [[ "$CIT_N" -ge 1 ]]; then ok "ask returned citations ($CIT_N) from pgvector retrieval"; else bad "ask returned NO citations (RAG retrieval found nothing)"; fi
echo "  answer:   ${ANSWER:0:200}"
echo "  citation: $(jq -rc '(.citations // [])[0] // {}' <<<"$JSON")"

# ── Summary ──────────────────────────────────────────────────────────────────
step "SUMMARY"
echo "  passed: $PASS    failed: $FAIL"
if [[ "$FAIL" -eq 0 ]]; then
  green "SMOKE TEST PASSED — cross-service summarize + ask working end-to-end."
  exit 0
else
  red "SMOKE TEST FAILED — $FAIL assertion(s) failed."
  exit 1
fi
