import type { Metadata } from "next";
import { GuideHeader, GuideSection, CodeBlock, SourceNote } from "@/components/developers/GuideChrome";

export const metadata: Metadata = {
  title: "Webhooks — Parlor developers",
};

export default function WebhooksGuide() {
  return (
    <div>
      <GuideHeader
        eyebrow="Guide"
        title="Webhooks"
        desc="HMAC-signed outbound event delivery with automatic retries — subscribe an endpoint and get notified as meetings progress."
      />

      <GuideSection title="Register an endpoint">
        <CodeBlock>{`curl -s -X POST $API/api/v1/webhooks \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID" \\
  -H 'Content-Type: application/json' \\
  -d '{"url": "https://you.example.com/hooks", "eventTypes": ["summary.ready"]}'`}</CodeBlock>
        <p className="mt-3 text-sm text-ink-muted">
          Omit <code className="rounded bg-surface-2 px-1">eventTypes</code> to
          subscribe to every event. The response includes a{" "}
          <code className="rounded bg-surface-2 px-1">whsec_...</code>-prefixed
          signing secret — save it, it&apos;s only shown once.
        </p>
        <SourceNote>
          <code>backend/src/api/product/routes_webhooks.py</code>,{" "}
          <code>backend/src/webhooks/events.py</code> (secret prefix)
        </SourceNote>
      </GuideSection>

      <GuideSection title="Event catalog">
        <CodeBlock>{`meeting.started
meeting.completed
transcript.ready
summary.ready
highlight.created
comment.created`}</CodeBlock>
        <SourceNote>
          <code>backend/src/webhooks/events.py</code> (<code>EVENT_TYPES</code>)
        </SourceNote>
      </GuideSection>

      <GuideSection title="Verifying the signature">
        <p className="text-sm leading-relaxed text-ink-muted">
          Every delivery carries an <code className="rounded bg-surface-2 px-1">X-Parlor-Signature</code>{" "}
          header shaped like Stripe/Svix&apos;s scheme:{" "}
          <code className="rounded bg-surface-2 px-1">t=&lt;unix timestamp&gt;,v1=&lt;hex HMAC-SHA256&gt;</code>.
          The signed string is <code className="rounded bg-surface-2 px-1">{`"{timestamp}.{body}"`}</code>.
        </p>
        <CodeBlock>{`import hashlib, hmac, time

def verify(secret: str, body: str, header: str, tolerance_sec: int = 300) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(","))
    ts, sig = int(parts["t"]), parts["v1"]
    if abs(time.time() - ts) > tolerance_sec:
        return False  # stale -> reject (replay protection)
    expected = hmac.new(secret.encode(), f"{ts}.{body}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)`}</CodeBlock>
        <SourceNote>
          <code>backend/src/webhooks/signing.py</code> — this is a direct port of
          that module&apos;s own <code>verify_signature</code>, not a new
          implementation
        </SourceNote>
      </GuideSection>

      <GuideSection title="Retries">
        <p className="text-sm leading-relaxed text-ink-muted">
          Failed deliveries retry with exponential backoff:{" "}
          <code className="rounded bg-surface-2 px-1">60s → 300s → 1800s → 7200s → 21600s</code>{" "}
          (the last interval repeats for any further attempts), capping total
          retry duration around 6 hours.
        </p>
        <SourceNote>
          <code>backend/src/webhooks/events.py</code> (<code>_BACKOFF_SCHEDULE</code>)
        </SourceNote>
      </GuideSection>

      <GuideSection title="Test an endpoint">
        <CodeBlock>{`curl -s -X POST $API/api/v1/webhooks/$WEBHOOK_ID/test \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID"`}</CodeBlock>
        <p className="mt-3 text-sm text-ink-muted">
          Enqueues a synthetic <code className="rounded bg-surface-2 px-1">webhook.test</code>{" "}
          event immediately — useful for verifying your signature-checking code
          without waiting for a real meeting to complete.
        </p>
        <SourceNote>
          <code>backend/src/api/product/routes_webhooks.py</code>
        </SourceNote>
      </GuideSection>
    </div>
  );
}
