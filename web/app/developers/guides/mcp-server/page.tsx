import type { Metadata } from "next";
import { GuideHeader, GuideSection, CodeBlock, SourceNote } from "@/components/developers/GuideChrome";

export const metadata: Metadata = {
  title: "MCP server — Parlor developers",
};

export default function McpServerGuide() {
  return (
    <div>
      <GuideHeader
        eyebrow="Guide"
        title="MCP server"
        desc="A Model Context Protocol server (mcp/ in this repo) that lets Claude Desktop, Claude Code, ChatGPT, or any MCP client search meetings, read transcripts, and ask grounded questions — without you writing any API client code."
      />

      <GuideSection title="What it is">
        <p className="mb-3 text-sm leading-relaxed text-ink-muted">
          A thin, read-mostly client over the same product API (
          <code className="rounded bg-surface-2 px-1">/api/v1</code>) these
          other guides use, authenticated with a workspace API key sent as{" "}
          <code className="rounded bg-surface-2 px-1">X-API-Key</code>. It runs
          as a separate process over stdio — no runtime dependency on the rest
          of the stack beyond the API itself.
        </p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-ink-faint">
              <th className="py-1.5 pr-4 font-mono text-xs uppercase tracking-wider">Tool</th>
              <th className="py-1.5 font-mono text-xs uppercase tracking-wider">Wraps</th>
            </tr>
          </thead>
          <tbody className="text-ink-soft">
            <tr className="border-b border-border-subtle">
              <td className="py-1.5 pr-4 font-mono text-xs">search_meetings</td>
              <td className="py-1.5 font-mono text-xs">GET /api/v1/meetings</td>
            </tr>
            <tr className="border-b border-border-subtle">
              <td className="py-1.5 pr-4 font-mono text-xs">get_meeting</td>
              <td className="py-1.5 font-mono text-xs">GET /api/v1/meetings/&#123;id&#125;</td>
            </tr>
            <tr className="border-b border-border-subtle">
              <td className="py-1.5 pr-4 font-mono text-xs">get_transcript</td>
              <td className="py-1.5 font-mono text-xs">
                GET /api/v1/meetings/&#123;id&#125;/transcript
              </td>
            </tr>
            <tr>
              <td className="py-1.5 pr-4 font-mono text-xs">ask_meetings</td>
              <td className="py-1.5 font-mono text-xs">
                POST /api/v1/meetings/&#123;id&#125;/ask
              </td>
            </tr>
          </tbody>
        </table>
        <SourceNote>
          <code>mcp/README.md</code> (tool table)
        </SourceNote>
      </GuideSection>

      <GuideSection title="One real limitation, stated plainly">
        <p className="text-sm leading-relaxed text-ink-muted">
          The product API only exposes a <em>per-meeting</em> ask endpoint
          publicly — there&apos;s no public cross-meeting equivalent yet. So{" "}
          <code className="rounded bg-surface-2 px-1">ask_meetings</code>{" "}
          called without a{" "}
          <code className="rounded bg-surface-2 px-1">meetingId</code> picks
          the most relevant recent meeting by word overlap between your
          question and meeting titles (falling back to the latest completed
          meeting), asks that one, and prefixes the answer with a note that
          the scope was narrowed. Pass an explicit{" "}
          <code className="rounded bg-surface-2 px-1">meetingId</code> for a
          deterministic target.
        </p>
        <SourceNote>
          <code>mcp/README.md</code> (&quot;Cross-meeting ask limitation&quot;),{" "}
          <code>mcp/src/tools/askMeetings.ts</code>
        </SourceNote>
      </GuideSection>

      <GuideSection title="Install & run">
        <CodeBlock>{`cd mcp
npm install
npm run build      # tsc -> dist/
npm run smoke      # in-memory tools/list + graceful-error test, no backend needed`}</CodeBlock>
        <CodeBlock>{`PARLOR_API_KEY=vk_live_... \\
PARLOR_API_URL=https://api.parlor.example \\
PARLOR_WORKSPACE_ID=... \\
node dist/server.js`}</CodeBlock>
        <p className="text-sm leading-relaxed text-ink-muted">
          <code className="rounded bg-surface-2 px-1">PARLOR_API_KEY</code> is
          the only required variable — the server exits with a clear message
          if it&apos;s missing.
        </p>
        <SourceNote>
          <code>mcp/README.md</code> (Configuration, Install &amp; build, Run)
        </SourceNote>
      </GuideSection>

      <GuideSection title="Register in an MCP client">
        <p className="mb-3 text-sm leading-relaxed text-ink-muted">
          Add to Claude Code&apos;s{" "}
          <code className="rounded bg-surface-2 px-1">.mcp.json</code> (or{" "}
          <code className="rounded bg-surface-2 px-1">~/.claude.json</code>) —
          Claude Desktop&apos;s{" "}
          <code className="rounded bg-surface-2 px-1">claude_desktop_config.json</code>{" "}
          takes the same shape under <code className="rounded bg-surface-2 px-1">mcpServers</code>.
        </p>
        <CodeBlock>{`{
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
}`}</CodeBlock>
        <SourceNote>
          <code>mcp/README.md</code> (&quot;Register in an MCP client&quot;)
        </SourceNote>
      </GuideSection>
    </div>
  );
}
