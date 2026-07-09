import type { Metadata } from "next";
import { GuideHeader, GuideSection, CodeBlock, SourceNote } from "@/components/developers/GuideChrome";

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
    </div>
  );
}
