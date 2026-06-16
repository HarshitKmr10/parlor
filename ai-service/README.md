# Meeting SaaS — AI Service

Internal (non-public) Python/FastAPI microservice that powers meeting summaries,
action-item / chapter extraction, transcript embeddings, and chat-with-meeting
(RAG). Called over HTTP by the backend. Implements the **AI service** section of
[`../docs/API-CONTRACT.md`](../docs/API-CONTRACT.md).

Runs on **port 8100**.

## Endpoints

| Method | Path         | Purpose                                                              |
| ------ | ------------ | -------------------------------------------------------------------- |
| GET    | `/health`    | Liveness + current mode / providers / DB status                     |
| POST   | `/summarize` | `{ meetingId, meta, segments }` → `MeetingInsights`                  |
| POST   | `/embed`     | `{ workspaceId, meetingId, segments }` → `{ embedded }` (pgvector)   |
| POST   | `/chat`      | `{ workspaceId, meetingId?, question, history? }` → `{ answer, citations }` |

JSON is camelCase (Pydantic v2 aliases). Errors use the envelope
`{ "error": { "code", "message" } }`.

## Provider routing & mock mode

A provider abstraction (`app/providers/`) has three implementations:

- **Anthropic Claude** (`anthropic` SDK) — premium model `claude-sonnet-4-6`,
  cheap model `claude-haiku-4-5-20251001`. Structured summaries via forced
  tool-use. No embeddings (falls through).
- **OpenAI** (`openai` SDK) — `gpt-4o` / `gpt-4o-mini`, embeddings via
  `text-embedding-3-small` (1536 dims).
- **Mock** — deterministic, structured responses and hash-based pseudo-embeddings
  so the whole system runs without any API keys.

Selection is driven by `AI_PROVIDER_ORDER` (default `anthropic,openai`). The
router tries providers in order and **falls through to the next on any error**;
if every live provider fails it degrades to the mock provider so requests still
return a structured response.

Mode is set by `AI_MODE` (`mock` | `live`) and **auto-detected**: `mock` when no
key is present, `live` otherwise. Keys come from `ANTHROPIC_API_KEY` /
`OPENAI_API_KEY` — never hardcoded.

## Embeddings + pgvector

`/embed` stores per-segment embeddings in Postgres using the **pgvector**
extension. The extension, the `meeting_embeddings` table, and an ivfflat cosine
index are created idempotently on startup. Connection via `DATABASE_URL`
(asyncpg). Without a database, `/summarize` still works; `/embed` and `/chat`
return a clear `503 store_unavailable` error.

`/chat` embeds the question, vector-searches the top-k segments scoped by
`workspaceId` (and `meetingId` when given), builds a grounded prompt, and returns
the answer with `Citation[]`. In mock mode it uses keyword search to produce
plausible, citation-backed answers.

## Run locally

```bash
cd ai-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Mock mode (no keys, no DB needed for /summarize):
uvicorn app.main:app --port 8100

# For /embed + /chat, bring up pgvector and point DATABASE_URL at it:
docker run -d --name pgvector -e POSTGRES_PASSWORD=postgres -p 5433:5432 pgvector/pgvector:pg16
export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres
uvicorn app.main:app --port 8100
```

Copy `.env.example` to `.env` and fill in keys to enable live mode.

## Docker

```bash
docker build -t meeting-ai-service ./ai-service
docker run -p 8100:8100 \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5433/postgres \
  meeting-ai-service
```

See [`docker-compose.snippet.yml`](docker-compose.snippet.yml) for a snippet the
backend's dev compose can reference.

## Example requests

```bash
# Health
curl -s http://localhost:8100/health

# Summarize
curl -s -X POST http://localhost:8100/summarize \
  -H 'content-type: application/json' \
  -d '{"meetingId":"m1","meta":{"title":"Standup","participants":["Ana","Ben"]},
       "segments":[{"id":"s1","speakerName":"Ana","text":"We will ship the API by next week.","tStartSec":0}]}'

# Embed (needs Postgres+pgvector)
curl -s -X POST http://localhost:8100/embed \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"w1","meetingId":"m1",
       "segments":[{"id":"s1","speakerName":"Ana","text":"We will ship the API by next week.","tStartSec":0}]}'

# Chat (needs Postgres+pgvector; embed first)
curl -s -X POST http://localhost:8100/chat \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"w1","meetingId":"m1","question":"When are we shipping the API?"}'
```

## Layout

```
app/
├── config.py            # env-driven settings, model IDs
├── schemas.py           # Pydantic v2 models (camelCase aliases)
├── dependencies.py      # router + store singletons
├── main.py              # FastAPI app, lifespan, error envelopes, /health
├── providers/           # LLM provider abstraction + routing
│   ├── base.py
│   ├── anthropic_provider.py
│   ├── openai_provider.py
│   ├── mock_provider.py
│   └── router.py
├── rag/
│   ├── summarize.py     # structured output + map-reduce
│   ├── store.py         # pgvector store (asyncpg)
│   └── chat.py          # retrieval + grounded answer
└── routes/
    └── insights.py      # /summarize, /embed, /chat
```
