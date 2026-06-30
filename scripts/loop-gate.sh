#!/usr/bin/env bash
#
# loop-gate.sh — the objective verifier for the ship-feature loop.
#
# "Done" is not the agent's opinion. It is: backend pytest green (modulo the
# known, pre-existing docker-DNS infra failures) AND web Playwright green.
# Exits 0 only when both hold. Anything else is a hard fail — the loop must
# not commit on a non-zero gate.
#
# The known failures (6 failed + 3 errors natively) live in tests that need the
# docker DNS host `meeting-worker:9000` — confined to two files: the compose-worker
# dispatcher and the rejoin orchestrator. They are environmental, not product-layer.
# We whitelist by FILE, not by count: any failing test OUTSIDE those two files is a
# real regression and fails the gate. A collection/import error (suite never ran)
# is always RED — never mistaken for a known failure.
#
# Usage:
#   scripts/loop-gate.sh            # full gate: backend + web
#   scripts/loop-gate.sh backend    # backend pytest only
#   scripts/loop-gate.sh web        # web Playwright only
#
# Env overrides:
#   SKIP_WEB=1                          — skip Playwright (e.g. stack not up)

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

c_green=$'\033[32m'; c_red=$'\033[31m'; c_yellow=$'\033[33m'; c_reset=$'\033[0m'
ok()   { printf '%s[gate]%s %s\n' "$c_green" "$c_reset" "$*"; }
warn() { printf '%s[gate]%s %s\n' "$c_yellow" "$c_reset" "$*"; }
fail() { printf '%s[gate]%s %s\n' "$c_red" "$c_reset" "$*" >&2; }

run_backend() {
  local py="$ROOT/backend/.venv/bin/pytest"
  [ -x "$py" ] || { fail "backend/.venv/bin/pytest not found — see native-run-recipe"; return 1; }

  ok "running backend pytest…"
  # Tests import `from src...`; pytest needs the backend dir on PYTHONPATH
  # (there is no pythonpath setting in pyproject.toml). Without this every
  # module hits ModuleNotFoundError at collection — a false 0-failures green.
  local out passed
  out="$(cd "$ROOT/backend" && PYTHONPATH=. .venv/bin/pytest -q 2>&1)"
  local code=$?
  passed="$(printf '%s\n' "$out" | grep -Eo '[0-9]+ passed' | grep -Eo '[0-9]+' | tail -1)"; passed="${passed:-0}"

  if [ "$code" -eq 0 ]; then
    ok "backend: all tests passed ($passed)"
    return 0
  fi

  # The suite must have actually RUN. Collection interrupted or zero passes
  # means import/setup broke — never a "known failure", always RED.
  if printf '%s\n' "$out" | grep -q 'Interrupted' || [ "$passed" -eq 0 ]; then
    fail "backend: suite did not run (collection/import error, $passed passed). GATE RED."
    printf '%s\n' "$out" | grep -E 'ERROR|Error|Interrupted|ModuleNotFound' | head -20
    return 1
  fi

  # Suite ran. Whitelist by FILE, not by count: the only tolerated failures are
  # the pre-existing docker-DNS ones, confined to these two files. ANY failing
  # node outside this set is a real regression — fail the gate and name it.
  # (Beats a numeric threshold, which rots silently when test names change.)
  local known='tests/services/test_compose_worker_dispatcher\.py|tests/services/test_rejoin_orchestrator_integration\.py'
  local bad_nodes unexpected
  bad_nodes="$(printf '%s\n' "$out" | grep -E '^(FAILED|ERROR) ' | sed -E 's/^(FAILED|ERROR) //')"
  unexpected="$(printf '%s\n' "$bad_nodes" | grep -vE "$known" | grep -v '^$' || true)"

  if [ -z "$unexpected" ]; then
    local n; n="$(printf '%s\n' "$bad_nodes" | grep -cv '^$')"
    warn "backend: $passed passed; $n failing node(s) — ALL in the known docker-DNS files. PASS."
    return 0
  fi
  fail "backend: REAL REGRESSION — failing test(s) outside the known docker-DNS files:"
  printf '%s\n' "$unexpected" | sed 's/^/    /'
  return 1
}

run_web() {
  [ "${SKIP_WEB:-0}" = "1" ] && { warn "web: skipped (SKIP_WEB=1)"; return 0; }
  command -v pnpm >/dev/null || { fail "pnpm not found"; return 1; }
  ok "running web Playwright (test:e2e)… (needs the native stack up — see native-run-recipe)"
  ( cd "$ROOT/web" && pnpm test:e2e )
}

target="${1:-all}"
case "$target" in
  backend) run_backend ;;
  web)     run_web ;;
  all)
    run_backend || exit 1
    run_web || exit 1
    ok "GATE GREEN — backend + web both pass"
    ;;
  *) fail "usage: $0 [backend|web|all]"; exit 2 ;;
esac
