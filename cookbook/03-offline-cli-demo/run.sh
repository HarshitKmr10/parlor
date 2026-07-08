#!/usr/bin/env bash
# Fully offline demo of the parlor-capture CLI: synthetic audio in, a local
# JSONL transcript out. No backend, no Docker, no network calls at all — the
# fastest way to see the botless capture pipeline's shape (audio -> STT ->
# segment) without any infrastructure.
set -euo pipefail

cd "$(dirname "$0")/../../desktop-capture"

if ! command -v parlor-capture >/dev/null 2>&1; then
  echo "parlor-capture not on PATH — installing into a local .venv ..."
  python3 -m venv .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install -e . >/dev/null
fi

OUT="$(mktemp -t parlor-cookbook-XXXX).jsonl"
echo "Running: parlor-capture capture --local --mock-audio --duration 3 --transcript-out $OUT"
parlor-capture capture --local --mock-audio --duration 3 --transcript-out "$OUT"

echo
echo "Local transcript written to $OUT:"
cat "$OUT"
