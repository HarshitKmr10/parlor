# Parlor MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets
MCP clients (Claude Desktop, Claude Code, ChatGPT, etc.) query a Parlor
workspace's meeting knowledge base — search meetings, read transcripts, and ask
grounded questions with citations.

It is a thin, read-mostly client over the Parlor backend product API
(`/api/v1`), authenticated with a **workspace API key** sent as the `X-API-Key`
header. No secrets are hardcoded; everything comes from environment variables.

## Tools

| Tool | Input | Wraps | Returns |
|------|-------|-------|---------|
| `search_meetings` | `{ query?: string, status?: MeetingStatus, limit?: 1-100 }` | `GET /api/v1/meetings` | Compact table of recent/matching meetings. `query` filters client-side over title + participants. |
| `get_meeting` | `{ meetingId: uuid }` | `GET /api/v1/meetings/{id}` | Meeting detail + insights (summary, key points, action items, chapters). |
| `get_transcript` | `{ meetingId: uuid, since?: ISO-8601 }` | `GET /api/v1/meetings/{id}/transcript` | Transcript segments with speaker + timestamps. |
| `ask_meetings` | `{ question: string, meetingId?: uuid }` | `POST /api/v1/meetings/{id}/ask` | Grounded answer with numbered citations (speaker + timestamp). |

`MeetingStatus` is one of `scheduled`, `joining`, `ongoing`, `completed`,
`failed`.

### Cross-meeting ask limitation

The backend product API only exposes a **per-meeting** ask endpoint
(`POST /api/v1/meetings/{id}/ask`). The internal ai-service `/chat` supports an
optional `meetingId` for true cross-meeting RAG, but it is not exposed publicly.

So when `ask_meetings` is called **without** a `meetingId`, the server picks the
most relevant recent meeting (word overlap between the question and meeting
titles, falling back to the latest completed meeting), asks that one, and
prefixes the answer with a note that the scope was narrowed. Pass an explicit
`meetingId` for a deterministic target. When the backend ships a public
cross-meeting ask, swap the routing in `src/tools/askMeetings.ts`.

## Configuration

| Env var | Required | Default | Purpose |
|---------|----------|---------|---------|
| `PARLOR_API_KEY` | **yes** | — | Workspace API key, sent as `X-API-Key`. Server exits with a clear message if missing. |
| `PARLOR_API_URL` | no | `http://localhost:8000` | Backend base URL (trailing slash trimmed). |
| `PARLOR_WORKSPACE_ID` | no | — | Sent as `X-Workspace-Id` to select the active workspace. |

See [`.env.example`](./.env.example).

## Install & build

```bash
npm install
npm run build      # tsc -> dist/
npm run typecheck  # tsc --noEmit (clean)
npm run smoke      # in-memory tools/list + graceful-error test, no backend needed
```

## Run

```bash
PARLOR_API_KEY=vk_live_... PARLOR_API_URL=https://api.parlor.example node dist/server.js
```

The server speaks MCP over **stdio**.

## Register in an MCP client

### Claude Code / `.mcp.json`

Add to your project's `.mcp.json` (or `~/.claude.json`):

```json
{
  "mcpServers": {
    "parlor": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/dist/server.js"],
      "env": {
        "PARLOR_API_URL": "https://api.parlor.example",
        "PARLOR_API_KEY": "vk_live_...",
        "PARLOR_WORKSPACE_ID": "00000000-0000-0000-0000-000000000000"
      }
    }
  }
}
```

If installed globally (`npm i -g`) or linked, the `parlor-mcp` bin works
directly:

```json
{
  "mcpServers": {
    "parlor": {
      "command": "parlor-mcp",
      "env": {
        "PARLOR_API_KEY": "vk_live_..."
      }
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)

Same shape, under `mcpServers`. On macOS the file lives at
`~/Library/Application Support/Claude/claude_desktop_config.json`. Restart the
app after editing.

## Architecture

```
src/
├── server.ts          # stdio bootstrap + createServer() factory
├── config.ts          # env parsing, fail-fast on missing API key
├── client.ts          # typed fetch client, unwraps { error: { code, message } }
├── format.ts          # pure renderers (tables, transcripts, citations)
├── types.ts           # API contract entities
└── tools/
    ├── index.ts        # registerTools() — wires tools onto the server
    ├── shared.ts       # safeRun + error -> tool-result translation
    ├── searchMeetings.ts
    ├── getMeeting.ts
    ├── getTranscript.ts
    └── askMeetings.ts
scripts/smoke.ts        # no-backend smoke test
```

Design notes:

- **Crash-safe tools.** Every handler runs inside `safeRun`, which converts any
  thrown error (network failure, non-2xx, timeout, bad JSON) into an `isError`
  tool result with a readable message. The server never crashes on a bad
  backend response.
- **Typed everything.** No `any`; `tsconfig` is `strict` with
  `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- **zod input schemas.** Each tool defines a raw zod shape; the SDK derives the
  JSON Schema advertised over `tools/list` and validates inputs before the
  handler runs.
```
