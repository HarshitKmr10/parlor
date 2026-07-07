# Content-quality eval harness

Every test in `tests/` before this harness checks API/route *correctness*
(status codes, schema shapes, provider fallback ordering) -- none of it
checks whether the generated *content* is any good. This harness fills that
one gap: it's a first pass the team should extend, not a comprehensive
quality benchmark. Plain `pytest`, no new eval library (no promptfoo, ragas,
deepeval, etc).

Lives under `tests/evals/`:

```
tests/evals/
├── fixtures/                       # synthetic meeting transcripts (JSON)
├── _helpers.py                     # fixture loader (not a test module)
├── test_mock_quality_invariants.py # mock-mode tier -- runs in CI, no keys
├── test_chat_groundedness.py       # mock-mode RAG groundedness -- needs a real pgvector DB
└── test_live_quality_spotcheck.py  # live-mode tier -- skips cleanly with no keys
```

## What this checks

- **Summarization**: the mock-mode summary is non-empty and shorter than the
  source transcript, for a handful of distinct meeting shapes (decision
  reached, routine standup, clear owners, rambling/no action items, a short
  meeting).
- **Action-item extraction**: for a transcript with clearly stated
  first-person commitments ("I will send... by Friday"), each extracted
  action item has non-empty text and a populated `assignee`. For a rambling
  transcript with no real follow-ups, it asserts the mock provider's actual,
  honest behavior (see below) rather than a coincidentally-true assertion.
- **RAG groundedness**: after embedding a fixture transcript through the
  same path `/embed` uses, every citation `/chat` returns must reference a
  `(meetingId, segmentId)` pair that was actually embedded, with citation
  text matching the real segment text -- never a fabricated reference.
- **Live-mode quality spot-check**: a few keyword/substring checks against a
  real provider's output (e.g. the summary actually names the vendor that
  was decided on), for a human to run before a release.

## What this does NOT check

- It is not a comprehensive quality benchmark and does not score summaries
  on any scale.
- It does not measure semantic accuracy or groundedness at scale, and does
  not use any scoring/grading library (no LLM-as-judge, no embedding
  similarity thresholds).
- It does not cover every transcript shape or edge case -- it's a handful of
  fixed cases, meant to be extended over time.
- It does not test locale/language quality. `MeetingMeta.target_language`
  only tags the summary with a `[lang]` prefix in
  `app/rag/summarize.py::_localize` -- the target language is never actually
  threaded into the prompt sent to the model (mock or live), so there is no
  real non-English generation behavior to eval yet. A non-English case was
  deliberately left out rather than asserting behavior the service doesn't
  actually implement; add one once `_localize` (or its caller) actually
  drives generation in the target language.

## A load-bearing mock-provider detail

`MockProvider.complete_json` (`app/providers/mock_provider.py`) always
appends a generic placeholder action item
(`"[mock] Review meeting notes."`, `assignee=None`) whenever a transcript has
segments but none matched its follow-up regex. That means "the action items
list is non-empty" is true unconditionally in mock mode and would be a
vacuous assertion for the rambling-transcript case. The real, non-vacuous
invariant that case tests is that the placeholder stays generic and
unattributed -- the mock never invents an owner or task that wasn't actually
said.

## Adding a new eval case

1. Add a transcript fixture: `tests/evals/fixtures/<name>.json`, shaped like
   the real `/summarize` request body (`meetingId`, `title`, `segments[]`
   with the same camelCase fields as `TranscriptSegment`).
2. Add a mock-mode invariant test in `test_mock_quality_invariants.py` (or a
   new `test_*.py` file for a distinct concern). Read the relevant
   `app/providers/mock_provider.py` / `app/rag/*.py` code first so the
   assertion targets something the mock code actually guarantees -- not
   something that happens to be true for one sample transcript.
3. Optionally add a live-mode keyword-check test in
   `test_live_quality_spotcheck.py`, guarded by the same key-presence
   `skipif` the existing tests use.

## Running

Mock tier (default, CI-safe, no keys, no DB needed for the summarization
tests):

```bash
cd ai-service
PYTHONPATH=. pytest tests/evals/test_mock_quality_invariants.py -q
```

RAG groundedness tier needs a real pgvector Postgres reachable at
`DATABASE_URL` (defaults to `postgresql://meeting:meeting@localhost:5432/meeting`,
matching `tests/test_chat.py`); it skips cleanly if unreachable:

```bash
cd ai-service
DATABASE_URL=postgresql://meeting:meeting@localhost:5432/meeting \
  PYTHONPATH=. pytest tests/evals/test_chat_groundedness.py -q
```

Live tier -- a human spot-check before a release, **not a CI gate**. Set one
of the real provider keys and run:

```bash
cd ai-service
ANTHROPIC_API_KEY=sk-ant-... PYTHONPATH=. pytest tests/evals/test_live_quality_spotcheck.py -q
# or OPENAI_API_KEY=... / AZURE_OPENAI_API_KEY=...+AZURE_OPENAI_ENDPOINT=...
```

With no keys set, `test_live_quality_spotcheck.py` reports every test as
`skipped` (not an error, not a silent pass).
