import type { Metadata } from "next";
import { GuideHeader, GuideSection, CodeBlock, SourceNote } from "@/components/developers/GuideChrome";

export const metadata: Metadata = {
  title: "Quickstart — Parlor developers",
};

export default function QuickstartGuide() {
  return (
    <div>
      <GuideHeader
        eyebrow="Guide"
        title="Quickstart"
        desc="Sign up, create a bot-free meeting, append a transcript, and read the AI summary — four requests, no bot dispatch."
      />

      <GuideSection title="1. Sign up">
        <CodeBlock>{`curl -s -X POST $API/api/v1/auth/signup \\
  -H 'Content-Type: application/json' \\
  -d '{
    "email": "you@example.com",
    "password": "a-strong-password",
    "name": "Your Name",
    "workspaceName": "Your Workspace"
  }'`}</CodeBlock>
        <p className="mt-3 text-sm text-ink-muted">
          Returns <code className="rounded bg-surface-2 px-1">accessToken</code>,{" "}
          <code className="rounded bg-surface-2 px-1">refreshToken</code>, and a{" "}
          <code className="rounded bg-surface-2 px-1">workspace</code> object. Use the
          workspace&apos;s <code className="rounded bg-surface-2 px-1">id</code> as{" "}
          <code className="rounded bg-surface-2 px-1">X-Workspace-Id</code> on every
          subsequent call.
        </p>
        <SourceNote>
          <code>backend/src/api/product/routes_auth.py</code> (<code>POST /signup</code>)
        </SourceNote>
      </GuideSection>

      <GuideSection title="2. Create a meeting — no bot joins anything">
        <CodeBlock>{`curl -s -X POST $API/api/v1/meetings/botless \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID" \\
  -H 'Content-Type: application/json' \\
  -d '{"title": "Roadmap sync", "source": "desktop"}'`}</CodeBlock>
        <p className="mt-3 text-sm text-ink-muted">
          Returns a <code className="rounded bg-surface-2 px-1">Meeting</code> with a
          synthetic <code className="rounded bg-surface-2 px-1">desktop://...</code>{" "}
          URL, <code className="rounded bg-surface-2 px-1">platform: &quot;desktop&quot;</code>,
          and <code className="rounded bg-surface-2 px-1">status: &quot;ongoing&quot;</code>.
        </p>
        <SourceNote>
          <code>backend/src/api/product/routes_meetings.py</code>,{" "}
          <code>cookbook/01-botless-capture/run.py</code>
        </SourceNote>
      </GuideSection>

      <GuideSection title="3. Append transcript segments">
        <CodeBlock>{`curl -s -X POST $API/api/v1/meetings/$MEETING_ID/transcript \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID" \\
  -H 'Content-Type: application/json' \\
  -d '{"segments": [
    {"id": "...", "speakerName": "Alex", "text": "Let'"'"'s review Q3.",
     "tStartSec": 0, "tEndSec": 4, "createdAt": "2026-01-01T00:00:00Z"}
  ]}'`}</CodeBlock>
        <SourceNote>
          <code>docs/API-CONTRACT.md</code>, <code>cookbook/01-botless-capture/run.py</code>
        </SourceNote>
      </GuideSection>

      <GuideSection title="4. Complete the meeting, then read the summary">
        <CodeBlock>{`curl -s -X POST $API/api/v1/meetings/$MEETING_ID/complete \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID"

curl -s -X POST $API/api/v1/meetings/$MEETING_ID/summarize \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID"`}</CodeBlock>
        <p className="mt-3 text-sm text-ink-muted">
          With no LLM provider key configured anywhere in the stack, the response
          comes back <code className="rounded bg-surface-2 px-1">[mock]</code>-prefixed
          but fully structured — real summary, key points, and action items. See{" "}
          <a href="/developers/guides/mock-mode-and-ask" className="underline">
            Mock mode &amp; Ask
          </a>{" "}
          for why that matters.
        </p>
        <SourceNote>
          <code>cookbook/02-mock-mode-summary-and-ask/run.py</code> (the exact response
          shape below is copied from a real run of that script)
        </SourceNote>
      </GuideSection>
    </div>
  );
}
