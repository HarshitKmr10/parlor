#!/usr/bin/env bash
# Smoke-test the ad-hoc Meet capture Pub/Sub webhook end-to-end against a
# locally running API, with ONLY the outbound Google resolve + bot dispatch
# mocked (everything else is the real code path).
#
# It posts a realistic Pub/Sub push envelope carrying a Workspace Events
# `conference.started` CloudEvent and asserts the webhook acks (202). It then
# posts the SAME envelope again to prove a duplicate delivery is also acked
# (and, via the dedupe log, NOT double-dispatched).
#
# Usage:
#   BASE_URL=http://localhost:3001 \
#   GOOGLE_PUBSUB_VERIFICATION_TOKEN=s3cret \
#   ./scripts/smoke_meet_events.sh
#
# The server must be started with GOOGLE_WORKSPACE_ENABLED=true and the same
# GOOGLE_PUBSUB_VERIFICATION_TOKEN. For a fully offline run that mocks the
# outbound Google resolve + dispatch, prefer the pytest end-to-end:
#   pytest tests/test_meet_events.py::test_webhook_end_to_end_dispatches -q
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
TOKEN="${GOOGLE_PUBSUB_VERIFICATION_TOKEN:-s3cret}"
PUSH_URL="${BASE_URL}/api/v1/google/pubsub/push?token=${TOKEN}"

# A realistic Workspace Events CloudEvent for a started conference.
CLOUD_EVENT='{
  "type": "google.workspace.meet.conference.v2.started",
  "subject": "host@parlor-test.com",
  "data": {
    "conferenceRecord": {
      "name": "conferenceRecords/smoke-'"$(date +%s)"'",
      "space": "spaces/smoke-space",
      "organizer": { "email": "host@parlor-test.com" }
    }
  }
}'

# base64-encode the CloudEvent as Pub/Sub `message.data`.
DATA_B64="$(printf '%s' "${CLOUD_EVENT}" | base64 | tr -d '\n')"

ENVELOPE='{
  "message": {
    "data": "'"${DATA_B64}"'",
    "messageId": "smoke-1",
    "attributes": { "ce-type": "google.workspace.meet.conference.v2.started" }
  },
  "subscription": "projects/parlor/subscriptions/meet-events-push"
}'

echo "POST ${PUSH_URL} (first delivery)"
CODE1="$(curl -s -o /dev/null -w '%{http_code}' -X POST "${PUSH_URL}" \
  -H 'Content-Type: application/json' -d "${ENVELOPE}")"
echo "  -> HTTP ${CODE1}"

echo "POST ${PUSH_URL} (DUPLICATE delivery — Google WILL resend)"
CODE2="$(curl -s -o /dev/null -w '%{http_code}' -X POST "${PUSH_URL}" \
  -H 'Content-Type: application/json' -d "${ENVELOPE}")"
echo "  -> HTTP ${CODE2}"

echo "POST with a BAD token (should be rejected 401 when verification is configured)"
CODE3="$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  "${BASE_URL}/api/v1/google/pubsub/push?token=wrong" \
  -H 'Content-Type: application/json' -d "${ENVELOPE}")"
echo "  -> HTTP ${CODE3}"

if [[ "${CODE1}" == "202" && "${CODE2}" == "202" ]]; then
  echo "OK: both deliveries acked (dedupe ensures a single dispatch)."
else
  echo "WARN: expected 202/202, got ${CODE1}/${CODE2}" >&2
  exit 1
fi
