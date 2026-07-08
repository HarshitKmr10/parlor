# Parlor cookbook

Small, runnable examples of Parlor's two actual differentiators:

1. **Botless capture** — a local client posts transcript segments straight to
   the backend, no server-side bot ever joins the call.
2. **Zero-API-key mock mode** — the AI service (`AI_MODE=mock`, the default
   with no `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` set) still produces a real,
   structurally-correct summary and answers questions over the transcript
   (RAG "Ask"), so you can see the whole pipeline work before ever touching
   an LLM key or a bill.

| Example | Demonstrates | Needs a live stack? | Needs an LLM key? |
|---|---|---|---|
| [`01-botless-capture/`](./01-botless-capture) | Posting transcript segments to the backend without a bot | Yes | No |
| [`02-mock-mode-summary-and-ask/`](./02-mock-mode-summary-and-ask) | `/summarize` + `/ask` (RAG) with zero LLM keys | Yes | No |
| [`03-offline-cli-demo/`](./03-offline-cli-demo) | The `parlor-capture` CLI running fully offline, no backend at all | No | No |

## Prerequisites for 01 and 02

From the repo root:

```bash
make up        # or: make up-api (lighter, no bot runtime — fine for these examples)
```

Wait for `make ps` to report `web`/`backend`/`ai-service`/`postgres` healthy.
These two examples talk to the backend directly over HTTP with `httpx`
(`pip install httpx`) — no other setup needed. They default to
`http://localhost:8001` for the backend, matching this repo's default `.env`
port; pass `--base-url` if you changed `API_PORT`.

## Prerequisites for 03

None beyond the `desktop-capture/` package itself:

```bash
cd desktop-capture
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
```

## What was actually verified

Every example in this directory was executed against a live local stack
(`make up`, no `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` set — `ai-service` running
`AI_MODE=mock`) while writing this cookbook, not just written to look
plausible. See each example's `README.md` for the exact commands and the real
response captured from that run. Nothing here depends on a live LLM provider
— that path was not exercised (no key available in this environment) and this
cookbook does not claim otherwise.
