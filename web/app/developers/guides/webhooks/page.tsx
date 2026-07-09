import type { Metadata } from "next";
import { GuideHeader, GuideSection, CodeBlock, SourceNote } from "@/components/developers/GuideChrome";
import { CodeTabs } from "@/components/developers/CodeTabs";

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
        <CodeTabs
          curl={`curl -s -X POST $API/api/v1/webhooks \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID" \\
  -H 'Content-Type: application/json' \\
  -d '{"url": "https://you.example.com/hooks", "eventTypes": ["summary.ready"]}'`}
          python={`r = httpx.post(
    f"{API}/api/v1/webhooks",
    json={"url": "https://you.example.com/hooks", "eventTypes": ["summary.ready"]},
    headers={"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id},
)
webhook = r.json()
secret = webhook["secret"]  # whsec_... -- save this now, shown only once`}
          typescript={`const res = await fetch(\`\${API}/api/v1/webhooks\`, {
  method: "POST",
  headers: { ...authHeaders, "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://you.example.com/hooks", eventTypes: ["summary.ready"] }),
});
const { secret } = await res.json(); // whsec_... -- save this now, shown only once`}
          go={`body, _ := json.Marshal(map[string]any{
    "url":        "https://you.example.com/hooks",
    "eventTypes": []string{"summary.ready"},
})
req, _ := http.NewRequest("POST", api+"/api/v1/webhooks", bytes.NewReader(body))
req.Header.Set("Authorization", "Bearer "+token)
req.Header.Set("X-Workspace-Id", workspaceID)
req.Header.Set("Content-Type", "application/json")
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()

var out struct {
    Secret string \`json:"secret"\` // whsec_... -- save this now, shown only once
}
json.NewDecoder(resp.Body).Decode(&out)`}
        />
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
        <CodeTabs
          python={`import hashlib, hmac, time

def verify(secret: str, body: str, header: str, tolerance_sec: int = 300) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(","))
    ts, sig = int(parts["t"]), parts["v1"]
    if abs(time.time() - ts) > tolerance_sec:
        return False  # stale -> reject (replay protection)
    expected = hmac.new(secret.encode(), f"{ts}.{body}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)`}
          typescript={`import { createHmac, timingSafeEqual } from "node:crypto";

function verify(secret: string, body: string, header: string, toleranceSec = 300): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const ts = Number(parts.t);
  const sig = parts.v1;
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false; // stale -> reject
  const expected = createHmac("sha256", secret).update(\`\${ts}.\${body}\`).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}`}
          go={`func Verify(secret, body, header string, toleranceSec int64) bool {
    parts := map[string]string{}
    for _, p := range strings.Split(header, ",") {
        kv := strings.SplitN(p, "=", 2)
        parts[kv[0]] = kv[1]
    }
    ts, _ := strconv.ParseInt(parts["t"], 10, 64)
    if abs(time.Now().Unix()-ts) > toleranceSec {
        return false // stale -> reject
    }
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(fmt.Sprintf("%d.%s", ts, body)))
    expected := hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(expected), []byte(parts["v1"]))
}`}
        />
        <SourceNote>
          <code>backend/src/webhooks/signing.py</code> — the Python version is a
          direct port of that module&apos;s own <code>verify_signature</code>;
          TypeScript/Go are receiver-side equivalents for a client verifying
          Parlor&apos;s deliveries, not code that ships in this repo
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
        <CodeTabs
          curl={`curl -s -X POST $API/api/v1/webhooks/$WEBHOOK_ID/test \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID"`}
          python={`httpx.post(
    f"{API}/api/v1/webhooks/{webhook_id}/test",
    headers={"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id},
).raise_for_status()`}
          typescript={`await fetch(\`\${API}/api/v1/webhooks/\${webhookId}/test\`, {
  method: "POST",
  headers: authHeaders,
});`}
          go={`req, _ := http.NewRequest("POST", api+"/api/v1/webhooks/"+webhookID+"/test", nil)
req.Header.Set("Authorization", "Bearer "+token)
req.Header.Set("X-Workspace-Id", workspaceID)
http.DefaultClient.Do(req)`}
        />
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
