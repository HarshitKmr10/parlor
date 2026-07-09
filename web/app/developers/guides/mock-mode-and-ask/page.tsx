import type { Metadata } from "next";
import { GuideHeader, GuideSection, CodeBlock, SourceNote } from "@/components/developers/GuideChrome";

export const metadata: Metadata = {
  title: "Mock mode & Ask — Parlor developers",
};

export default function MockModeAndAskGuide() {
  return (
    <div>
      <GuideHeader
        eyebrow="Guide"
        title="Mock mode & Ask"
        desc="A genuine zero-API-key AI mode, and a cross-meeting RAG search endpoint with citations."
      />

      <GuideSection title="Mock mode">
        <p className="text-sm leading-relaxed text-ink-muted">
          ai-service auto-detects whether any LLM provider key
          (<code className="rounded bg-surface-2 px-1">ANTHROPIC_API_KEY</code>,{" "}
          <code className="rounded bg-surface-2 px-1">OPENAI_API_KEY</code>, etc.) is
          configured. If none are, it runs entirely in{" "}
          <code className="rounded bg-surface-2 px-1">AI_MODE=mock</code> — every
          summarize/ask/embed call still returns a real, structured response, just{" "}
          <code className="rounded bg-surface-2 px-1">[mock]</code>-prefixed instead
          of LLM-generated. This is not a stub that returns empty data — the whole
          product works end-to-end with zero credentials.
        </p>
        <SourceNote>
          <code>ai-service/app/config.py</code> (mode auto-detection)
        </SourceNote>
      </GuideSection>

      <GuideSection title="Summarize a meeting">
        <CodeBlock>{`curl -s -X POST $API/api/v1/meetings/$MEETING_ID/summarize \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID"`}</CodeBlock>
        <p className="mt-3 text-sm text-ink-muted">Returns:</p>
        <CodeBlock>{`{
  "summary": "[mock] Discussion titled 'Q3 roadmap sync' across 3 segment(s) ...",
  "keyPoints": ["Let's review the Q3 roadmap...", "..."],
  "actionItems": [
    {"id": "...", "text": "...", "assignee": "Alex", "dueDate": null, "done": false}
  ],
  "chapters": [{"id": "...", "title": "[mock] Part 1: ...", "tStartSec": 0.0, "tEndSec": 6.0}]
}`}</CodeBlock>
        <SourceNote>
          Actual response captured from a live run of{" "}
          <code>cookbook/02-mock-mode-summary-and-ask/run.py</code> against{" "}
          <code>AI_MODE=mock</code>
        </SourceNote>
      </GuideSection>

      <GuideSection title="Ask a single meeting">
        <CodeBlock>{`curl -s -X POST $API/api/v1/meetings/$MEETING_ID/ask \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID" \\
  -H 'Content-Type: application/json' \\
  -d '{"question": "Who owns the PyPI publishing workflow?"}'`}</CodeBlock>
        <SourceNote>
          <code>backend/src/api/product/routes_meetings.py</code> (
          <code>POST /{"{"}meeting_id{"}"}/ask</code>)
        </SourceNote>
      </GuideSection>

      <GuideSection title="Ask across the whole workspace">
        <p className="text-sm leading-relaxed text-ink-muted">
          Parlor&apos;s marquee capability: RAG retrieval over every meeting in the
          workspace at once, not just one — resolving each citation back to its
          source meeting title.
        </p>
        <CodeBlock>{`curl -s -X POST $API/api/v1/ask \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID" \\
  -H 'Content-Type: application/json' \\
  -d '{"question": "What did we decide about pricing?"}'`}</CodeBlock>
        <p className="mt-3 text-sm text-ink-muted">Returns:</p>
        <CodeBlock>{`{
  "answer": "[mock] Based on the meeting transcript, regarding \\"...\\": ...",
  "citations": [
    {"segmentId": "...", "speakerName": "Sam", "text": "...",
     "tStartSec": 6.0, "meetingId": "...", "meetingTitle": "Q3 roadmap sync"}
  ]
}`}</CodeBlock>
        <SourceNote>
          <code>backend/src/api/product/routes_ask.py</code> — &quot;Unlike POST
          /meetings/{"{"}id{"}"}/ask (single meeting), this runs RAG retrieval across
          the ENTIRE workspace transcript corpus.&quot; Response shape verified
          against a live call to the hosted instance.
        </SourceNote>
      </GuideSection>
    </div>
  );
}
