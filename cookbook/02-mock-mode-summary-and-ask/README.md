# 02 — Zero-API-key mock mode: summary + RAG Ask

Demonstrates that the full "capture -> summarize -> ask" pipeline works with
**no LLM key configured anywhere in the stack**. `ai-service` runs in
`AI_MODE=mock` whenever `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` aren't set (the
default for a fresh `make up`) and returns deterministic, structurally-real
`MeetingInsights` and RAG answers — enough to develop and demo against
without touching a live model or a bill.

## Run it

```bash
pip install httpx
python run.py --base-url http://localhost:8001   # match your API_PORT
python run.py --question "What did Alex propose?"  # ask something else
```

## What was actually verified

Run against a live `make up` stack in this environment with no LLM keys set
(backend on `http://localhost:8002` in this sandbox; `ai-service` reporting
`"mode":"mock"` on `/health`). Full real output from that run:

```json
{
  "summary": "[mock] Discussion titled 'Q3 roadmap sync' across 3 segment(s) involving Alex, Sam. Let's review the Q3 roadmap. Top priority is shipping the PyPI package for desktop-capture. Agreed. I'll own the GitHub Actions trusted publishing workflow and have it ready by Friday. Great, and let's also add a cookbook of runnable examples so new users can see it work end to e",
  "keyPoints": [
    "Let's review the Q3 roadmap. Top priority is shipping the PyPI package for desktop-capture.",
    "Agreed. I'll own the GitHub Actions trusted publishing workflow and have it ready by Friday.",
    "Great, and let's also add a cookbook of runnable examples so new users can see it work end to end."
  ],
  "actionItems": [
    { "text": "Let's review the Q3 roadmap. Top priority is shipping the PyPI package for desktop-capture.", "assignee": "Alex", "dueDate": null, "done": false },
    { "text": "Great, and let's also add a cookbook of runnable examples so new users can see it work end to end.", "assignee": "Alex", "dueDate": null, "done": false }
  ],
  "chapters": [
    { "title": "[mock] Part 1: Let's review the Q3 roadmap. Top priority is shipp", "tStartSec": 0.0, "tEndSec": 6.0 },
    { "title": "[mock] Part 2: Agreed. I'll own the GitHub Actions trusted publis", "tStartSec": 6.0, "tEndSec": 12.0 },
    { "title": "[mock] Part 3: Great, and let's also add a cookbook of runnable e", "tStartSec": 12.0, "tEndSec": 18.0 }
  ]
}
```

and for `/ask "Who owns the PyPI publishing workflow?"`:

```json
{
  "answer": "[mock] Based on the meeting transcript, regarding \"Who owns the PyPI publishing workflow?\": Agreed. I'll own the GitHub Actions trusted publishing workflow and have it ready by Friday. Let's review the Q3 roadmap. Top priority is shipping the PyPI package for desktop-capture.",
  "citations": [
    { "speakerName": "Sam", "text": "Agreed. I'll own the GitHub Actions trusted publishing workflow and have it ready by Friday.", "tStartSec": 6.0 },
    { "speakerName": "Alex", "text": "Let's review the Q3 roadmap. Top priority is shipping the PyPI package for desktop-capture.", "tStartSec": 0.0 }
  ]
}
```

The `[mock]` prefix and the mock provider's retrieval-by-keyword-overlap
behavior are visible directly in the output (see `ai-service`'s mock
provider implementation) — this is not a live LLM response, and the
script asserts on that marker so it fails loudly if `ai-service` is ever
switched to live mode by whoever runs it.

## What this does NOT verify

**Live-mode summarize/ask (a real Anthropic/OpenAI key) was not exercised —
no LLM key was available in this environment.** The mock-mode contract
(same response shape, same endpoints) is what backs live mode too, but the
actual model output quality is unverified here. If you have a key, set
`ANTHROPIC_API_KEY` or `OPENAI_API_KEY` before `make up` and re-run this
script — the `assert` on the `[mock]` prefix will need to be removed first.
