import type { Metadata } from "next";
import { GuideHeader, GuideSection, CodeBlock, SourceNote } from "@/components/developers/GuideChrome";
import { CodeTabs } from "@/components/developers/CodeTabs";

export const metadata: Metadata = {
  title: "Botless capture — Parlor developers",
};

export default function BotlessCaptureGuide() {
  return (
    <div>
      <GuideHeader
        eyebrow="Guide"
        title="Botless capture"
        desc="Post transcript segments straight to Parlor's backend. No server-side bot ever joins a call."
      />

      <GuideSection title="Why this exists">
        <p className="text-sm leading-relaxed text-ink-muted">
          Parlor&apos;s other capture path (<code className="rounded bg-surface-2 px-1">POST /api/v1/meetings</code>)
          dispatches a Playwright bot into a real Zoom/Meet/Teams URL. Botless
          capture is the opposite: a local client (this repo ships one at{" "}
          <code className="rounded bg-surface-2 px-1">desktop-capture/</code>) records your
          machine&apos;s system/meeting audio, transcribes it locally, and streams the
          transcript to the backend — no bot, no third-party meeting infrastructure
          involved at all.
        </p>
        <SourceNote>
          <code>desktop-capture/README.md</code>
        </SourceNote>
      </GuideSection>

      <GuideSection title="The three calls">
        <CodeBlock>{`# 1. Create a botless meeting (source defaults to "desktop")
curl -s -X POST $API/api/v1/meetings/botless \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID" \\
  -H 'Content-Type: application/json' -d '{"title": "Standup"}'

# 2. Stream segments as your own capture pipeline produces them
curl -s -X POST $API/api/v1/meetings/$MEETING_ID/transcript \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID" \\
  -H 'Content-Type: application/json' \\
  -d '{"segments": [{"id":"...","speakerName":"You","text":"...","tStartSec":0,"tEndSec":4,"createdAt":"..."}]}'

# 3. Mark it complete when the call ends
curl -s -X POST $API/api/v1/meetings/$MEETING_ID/complete \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID"`}</CodeBlock>
        <p className="mt-3 text-sm text-ink-muted">
          Segments can arrive in any order — the server sorts by{" "}
          <code className="rounded bg-surface-2 px-1">tStartSec</code> and clamps
          timestamps to stay monotonic, so a slightly-out-of-order stream from a
          real capture pipeline doesn&apos;t produce a garbled transcript.
        </p>
        <SourceNote>
          <code>backend/src/api/product/schemas.py</code> (
          <code>TranscriptIngestRequest</code>), <code>docs/API-CONTRACT.md</code>
        </SourceNote>
      </GuideSection>

      <GuideSection title="The reference client">
        <p className="text-sm leading-relaxed text-ink-muted">
          <code className="rounded bg-surface-2 px-1">desktop-capture/</code> (Python,
          macOS-first) is a real, working implementation of this pattern: audio
          capture → speech-to-text → segment shaping → the same{" "}
          <code className="rounded bg-surface-2 px-1">POST .../transcript</code> call
          above. Its STT layer is pluggable — a <code className="rounded bg-surface-2 px-1">mock</code>{" "}
          backend (canned segments, no model, good for testing your own
          integration) and a <code className="rounded bg-surface-2 px-1">faster-whisper</code>{" "}
          offline backend both ship today. It does not diarize (multi-speaker
          attribution) in the offline path.
        </p>
        <SourceNote>
          <code>desktop-capture/README.md</code>
        </SourceNote>
      </GuideSection>

      <GuideSection title="A minimal capture client you can drop into your own project">
        <p className="mb-3 text-sm leading-relaxed text-ink-muted">
          If you&apos;re not using <code className="rounded bg-surface-2 px-1">desktop-capture/</code>{" "}
          directly, this is the whole contract wrapped as one reusable client —
          create once, call <code className="rounded bg-surface-2 px-1">append()</code>{" "}
          as your own STT pipeline produces text, then{" "}
          <code className="rounded bg-surface-2 px-1">finish()</code>.
        </p>
        <CodeTabs
          python={`import uuid
from datetime import datetime, timezone
import httpx

class ParlorCapture:
    def __init__(self, base_url: str, token: str, workspace_id: str):
        self._headers = {"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id}
        self._client = httpx.Client(base_url=base_url, headers=self._headers)
        self.meeting_id: str | None = None

    def start(self, title: str) -> str:
        r = self._client.post("/api/v1/meetings/botless", json={"title": title, "source": "desktop"})
        r.raise_for_status()
        self.meeting_id = r.json()["id"]
        return self.meeting_id

    def append(self, speaker: str, text: str, t_start_sec: float, t_end_sec: float) -> None:
        segment = {
            "id": str(uuid.uuid4()),
            "speakerName": speaker,
            "text": text,
            "tStartSec": t_start_sec,
            "tEndSec": t_end_sec,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        r = self._client.post(f"/api/v1/meetings/{self.meeting_id}/transcript", json={"segments": [segment]})
        r.raise_for_status()

    def finish(self) -> None:
        r = self._client.post(f"/api/v1/meetings/{self.meeting_id}/complete")
        r.raise_for_status()

# usage
capture = ParlorCapture(API, token, workspace_id)
capture.start("Standup")
capture.append("You", "Let's kick things off.", 0, 3)
capture.finish()`}
          typescript={`class ParlorCapture {
  private headers: Record<string, string>;
  private meetingId: string | null = null;

  constructor(private baseUrl: string, token: string, workspaceId: string) {
    this.headers = { Authorization: \`Bearer \${token}\`, "X-Workspace-Id": workspaceId };
  }

  private async post(path: string, body?: unknown) {
    return fetch(\`\${this.baseUrl}\${path}\`, {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async start(title: string): Promise<string> {
    const res = await this.post("/api/v1/meetings/botless", { title, source: "desktop" });
    const meeting = await res.json();
    this.meetingId = meeting.id;
    return meeting.id;
  }

  async append(speaker: string, text: string, tStartSec: number, tEndSec: number) {
    const segment = {
      id: crypto.randomUUID(),
      speakerName: speaker,
      text,
      tStartSec,
      tEndSec,
      createdAt: new Date().toISOString(),
    };
    await this.post(\`/api/v1/meetings/\${this.meetingId}/transcript\`, { segments: [segment] });
  }

  async finish() {
    await this.post(\`/api/v1/meetings/\${this.meetingId}/complete\`);
  }
}

// usage
const capture = new ParlorCapture(API, token, workspaceId);
await capture.start("Standup");
await capture.append("You", "Let's kick things off.", 0, 3);
await capture.finish();`}
          go={`// requires "github.com/google/uuid"
type ParlorCapture struct {
    BaseURL, Token, WorkspaceID, MeetingID string
    client                                *http.Client
}

func (c *ParlorCapture) do(method, path string, body []byte) (*http.Response, error) {
    req, _ := http.NewRequest(method, c.BaseURL+path, bytes.NewReader(body))
    req.Header.Set("Authorization", "Bearer "+c.Token)
    req.Header.Set("X-Workspace-Id", c.WorkspaceID)
    req.Header.Set("Content-Type", "application/json")
    return c.client.Do(req)
}

func (c *ParlorCapture) Start(title string) (string, error) {
    body, _ := json.Marshal(map[string]string{"title": title, "source": "desktop"})
    resp, err := c.do("POST", "/api/v1/meetings/botless", body)
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()
    var meeting struct{ ID string \`json:"id"\` }
    json.NewDecoder(resp.Body).Decode(&meeting)
    c.MeetingID = meeting.ID
    return meeting.ID, nil
}

func (c *ParlorCapture) Append(speaker, text string, tStartSec, tEndSec float64) error {
    segment := map[string]any{
        "id": uuid.NewString(), "speakerName": speaker, "text": text,
        "tStartSec": tStartSec, "tEndSec": tEndSec, "createdAt": time.Now().UTC().Format(time.RFC3339),
    }
    body, _ := json.Marshal(map[string]any{"segments": []any{segment}})
    _, err := c.do("POST", "/api/v1/meetings/"+c.MeetingID+"/transcript", body)
    return err
}

func (c *ParlorCapture) Finish() error {
    _, err := c.do("POST", "/api/v1/meetings/"+c.MeetingID+"/complete", nil)
    return err
}`}
        />
      </GuideSection>
    </div>
  );
}
