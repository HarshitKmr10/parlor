import type { Metadata } from "next";
import { PUBLIC_API_BASE_URL } from "@/lib/api/config";

export const metadata: Metadata = {
  title: "Developers — Verdant",
};

const QUICKSTART = `# 1. Authenticate (or use a workspace API key from Settings)
curl -s -X POST $API/api/v1/auth/login \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"you@example.com","password":"…"}'

# 2. List meetings (send the bearer token + workspace id)
curl -s $API/api/v1/meetings \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-Workspace-Id: $WORKSPACE_ID"

# 3. Ask across every meeting
curl -s -X POST $API/api/v1/ask \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID" \\
  -H 'Content-Type: application/json' \\
  -d '{"question":"What did we decide about pricing?"}'

# 4. Subscribe to events (HMAC-signed, auto-retried)
curl -s -X POST $API/api/v1/webhooks \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID" \\
  -H 'Content-Type: application/json' \\
  -d '{"url":"https://you.example.com/hooks","eventTypes":["summary.ready"]}'`;

function CardLink({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-border-subtle bg-surface-0 p-4 shadow-soft-sm transition-colors hover:border-border-strong"
    >
      <p className="font-display text-base text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">{desc}</p>
    </a>
  );
}

export default function DevelopersPage() {
  const docsUrl = `${PUBLIC_API_BASE_URL}/docs`;
  const openapiUrl = `${PUBLIC_API_BASE_URL}/openapi.json`;
  const redocUrl = `${PUBLIC_API_BASE_URL}/redoc`;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <p className="eyebrow mb-1.5">Platform</p>
        <h1 className="font-display text-2xl text-ink">Developers</h1>
        <p className="mt-1.5 max-w-xl text-sm text-ink-muted">
          Build on Verdant with a REST API, HMAC-signed webhooks, and an MCP
          server. Authenticate with a workspace API key from Settings.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CardLink href={docsUrl} title="API reference" desc="Interactive Swagger UI for every endpoint." />
        <CardLink href={redocUrl} title="ReDoc" desc="A clean, readable reference view." />
        <CardLink href={openapiUrl} title="OpenAPI spec" desc="Generate a typed SDK from openapi.json." />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg text-ink">Quickstart</h2>
        <pre className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-1 p-4 font-mono text-xs leading-relaxed text-ink-soft">
          <code>{QUICKSTART}</code>
        </pre>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink">Generate an SDK</h2>
        <pre className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-1 p-4 font-mono text-xs leading-relaxed text-ink-soft">
          <code>{`npx @openapitools/openapi-generator-cli generate \\
  -i ${openapiUrl} \\
  -g typescript-fetch \\
  -o ./verdant-sdk`}</code>
        </pre>
        <p className="mt-3 text-sm text-ink-muted">
          Swap <code className="rounded bg-surface-2 px-1">typescript-fetch</code> for{" "}
          <code className="rounded bg-surface-2 px-1">python</code>,{" "}
          <code className="rounded bg-surface-2 px-1">go</code>, or any of the
          50+ OpenAPI Generator targets.
        </p>
      </section>
    </div>
  );
}
