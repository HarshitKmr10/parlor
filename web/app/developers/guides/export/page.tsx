import type { Metadata } from "next";
import { GuideHeader, GuideSection, SourceNote } from "@/components/developers/GuideChrome";
import { CodeTabs } from "@/components/developers/CodeTabs";

export const metadata: Metadata = {
  title: "Exporting meetings — Parlor developers",
};

export default function ExportGuide() {
  return (
    <div>
      <GuideHeader
        eyebrow="Guide"
        title="Exporting meetings"
        desc="Pull a meeting's summary, action items, and transcript out as Markdown — importable directly into Obsidian or Notion."
      />

      <GuideSection title="Export as Markdown">
        <CodeTabs
          curl={`curl -s "$API/api/v1/meetings/$MEETING_ID/export?format=markdown" \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID" \\
  -o meeting.md`}
          python={`r = httpx.get(
    f"{API}/api/v1/meetings/{meeting_id}/export",
    params={"format": "markdown"},
    headers={"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id},
)
r.raise_for_status()
open("meeting.md", "wb").write(r.content)`}
          typescript={`const res = await fetch(
  \`\${API}/api/v1/meetings/\${meetingId}/export?format=markdown\`,
  { headers: authHeaders },
);
const markdown = await res.text();
await Deno.writeTextFile("meeting.md", markdown); // or fs.writeFile in Node`}
          go={`req, _ := http.NewRequest("GET", api+"/api/v1/meetings/"+meetingID+"/export?format=markdown", nil)
req.Header.Set("Authorization", "Bearer "+token)
req.Header.Set("X-Workspace-Id", workspaceID)
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()

out, _ := os.Create("meeting.md")
defer out.Close()
io.Copy(out, resp.Body)`}
        />
        <p className="mt-3 text-sm text-ink-muted">
          Returns <code className="rounded bg-surface-2 px-1">text/markdown</code>{" "}
          with a <code className="rounded bg-surface-2 px-1">Content-Disposition:
          attachment</code> header, so it downloads with a sensible filename
          derived from the meeting title.
        </p>
        <SourceNote>
          <code>backend/src/api/product/routes_meetings.py</code> (
          <code>GET /{"{"}meeting_id{"}"}/export</code>)
        </SourceNote>
      </GuideSection>

      <GuideSection title="Why Markdown, not a Notion/Obsidian integration">
        <p className="text-sm leading-relaxed text-ink-muted">
          Markdown substantially covers both asks at once: Obsidian reads{" "}
          <code className="rounded bg-surface-2 px-1">.md</code> files directly if
          you drop them into a vault, and Notion imports Markdown natively via{" "}
          <em>Import → Markdown</em>. Neither needs a bespoke OAuth integration —
          which is deliberate; a real push-integration would require registering
          an OAuth app with each platform, credentials this project doesn&apos;t
          hold.
        </p>
        <SourceNote>
          <code>backend/src/api/product/meeting_export.py</code> (module docstring)
        </SourceNote>
      </GuideSection>

      <GuideSection title="What's in the document">
        <p className="text-sm leading-relaxed text-ink-muted">
          Title, date, platform, status, summary, key points, action items as a
          Markdown checklist, and an inlined transcript excerpt — capped at 200
          segments so a multi-hour meeting doesn&apos;t produce an unwieldy
          multi-megabyte file (a note points back to the in-app transcript tab for
          the rest).
        </p>
        <SourceNote>
          <code>backend/src/api/product/meeting_export.py</code> (
          <code>_MAX_INLINE_TRANSCRIPT_SEGMENTS</code>)
        </SourceNote>
      </GuideSection>

      <GuideSection title="Other formats">
        <p className="text-sm leading-relaxed text-ink-muted">
          Any other <code className="rounded bg-surface-2 px-1">format</code> value
          returns <code className="rounded bg-surface-2 px-1">400
          unsupported_export_format</code>. PDF is planned but not yet
          implemented — documented honestly here rather than left silently
          broken.
        </p>
        <SourceNote>
          <code>backend/src/api/product/routes_meetings.py</code> (export route
          description)
        </SourceNote>
      </GuideSection>
    </div>
  );
}
