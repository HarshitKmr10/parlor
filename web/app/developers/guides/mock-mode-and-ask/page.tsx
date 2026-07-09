import type { Metadata } from "next";
import { GuideHeader, GuideSection, CodeBlock, SourceNote } from "@/components/developers/GuideChrome";
import { CodeTabs } from "@/components/developers/CodeTabs";

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
        <CodeTabs
          curl={`curl -s -X POST $API/api/v1/meetings/$MEETING_ID/summarize \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID"`}
          python={`r = httpx.post(
    f"{API}/api/v1/meetings/{meeting_id}/summarize",
    headers={"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id},
)
r.raise_for_status()
print(r.json()["summary"])`}
          typescript={`const res = await fetch(\`\${API}/api/v1/meetings/\${meetingId}/summarize\`, {
  method: "POST",
  headers: authHeaders,
});
const { summary } = await res.json();`}
          go={`req, _ := http.NewRequest("POST", api+"/api/v1/meetings/"+meetingID+"/summarize", nil)
req.Header.Set("Authorization", "Bearer "+token)
req.Header.Set("X-Workspace-Id", workspaceID)
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()

var out struct {
    Summary string \`json:"summary"\`
}
json.NewDecoder(resp.Body).Decode(&out)`}
        />
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
        <CodeTabs
          curl={`curl -s -X POST $API/api/v1/meetings/$MEETING_ID/ask \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID" \\
  -H 'Content-Type: application/json' \\
  -d '{"question": "Who owns the PyPI publishing workflow?"}'`}
          python={`r = httpx.post(
    f"{API}/api/v1/meetings/{meeting_id}/ask",
    json={"question": "Who owns the PyPI publishing workflow?"},
    headers={"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id},
)
print(r.json()["answer"])`}
          typescript={`const res = await fetch(\`\${API}/api/v1/meetings/\${meetingId}/ask\`, {
  method: "POST",
  headers: { ...authHeaders, "Content-Type": "application/json" },
  body: JSON.stringify({ question: "Who owns the PyPI publishing workflow?" }),
});
const { answer, citations } = await res.json();`}
          go={`body, _ := json.Marshal(map[string]string{"question": "Who owns the PyPI publishing workflow?"})
req, _ := http.NewRequest("POST", api+"/api/v1/meetings/"+meetingID+"/ask", bytes.NewReader(body))
req.Header.Set("Authorization", "Bearer "+token)
req.Header.Set("X-Workspace-Id", workspaceID)
req.Header.Set("Content-Type", "application/json")
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()`}
        />
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
        <CodeTabs
          curl={`curl -s -X POST $API/api/v1/ask \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID" \\
  -H 'Content-Type: application/json' \\
  -d '{"question": "What did we decide about pricing?"}'`}
          python={`r = httpx.post(
    f"{API}/api/v1/ask",
    json={"question": "What did we decide about pricing?"},
    headers={"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id},
)
answer = r.json()
for c in answer["citations"]:
    print(c["meetingTitle"], c["speakerName"], c["text"])`}
          typescript={`const res = await fetch(\`\${API}/api/v1/ask\`, {
  method: "POST",
  headers: { ...authHeaders, "Content-Type": "application/json" },
  body: JSON.stringify({ question: "What did we decide about pricing?" }),
});
const { answer, citations } = await res.json();`}
          go={`body, _ := json.Marshal(map[string]string{"question": "What did we decide about pricing?"})
req, _ := http.NewRequest("POST", api+"/api/v1/ask", bytes.NewReader(body))
req.Header.Set("Authorization", "Bearer "+token)
req.Header.Set("X-Workspace-Id", workspaceID)
req.Header.Set("Content-Type", "application/json")
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()

var out struct {
    Answer    string \`json:"answer"\`
    Citations []struct {
        MeetingTitle string \`json:"meetingTitle"\`
        SpeakerName  string \`json:"speakerName"\`
        Text         string \`json:"text"\`
    } \`json:"citations"\`
}
json.NewDecoder(resp.Body).Decode(&out)`}
        />
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
