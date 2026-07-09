import type { Metadata } from "next";
import { GuideHeader, GuideSection, CodeBlock, SourceNote } from "@/components/developers/GuideChrome";
import { CodeTabs } from "@/components/developers/CodeTabs";

export const metadata: Metadata = {
  title: "Rate limits & quotas — Parlor developers",
};

export default function RateLimitsGuide() {
  return (
    <div>
      <GuideHeader
        eyebrow="Guide"
        title="Rate limits & quotas"
        desc="Per-request rate limits apply to every deployment. A separate, opt-in usage cap may apply on hosted instances specifically — not on your own self-host."
      />

      <GuideSection title="Per-request rate limits">
        <p className="text-sm leading-relaxed text-ink-muted">
          A token-bucket limit per principal (API key / user / IP), with a
          stricter tier for the unauthenticated public surface:
        </p>
        <CodeBlock>{`Authenticated (default):  10 requests/sec, burst 60
Public (unauthenticated):  2 requests/sec, burst 20
Auth (login / password-reset):  0.2 requests/sec, burst 5`}</CodeBlock>
        <p className="mt-3 text-sm text-ink-muted">
          Exceeding a limit returns <code className="rounded bg-surface-2 px-1">429</code>{" "}
          with a <code className="rounded bg-surface-2 px-1">Retry-After</code>{" "}
          header. Every response carries{" "}
          <code className="rounded bg-surface-2 px-1">X-RateLimit-*</code>{" "}
          headers so you can back off before actually hitting the limit.
        </p>
        <SourceNote>
          <code>backend/src/ratelimit/middleware.py</code> (module docstring —
          tunable per-deployment via <code>RATE_LIMIT_*</code> env vars;{" "}
          <code>Retry-After</code>/<code>X-RateLimit-Limit</code>/
          <code>X-RateLimit-Remaining</code> header names read directly from that
          file&apos;s implementation)
        </SourceNote>
      </GuideSection>

      <GuideSection title="A wrapper that backs off automatically">
        <p className="mb-3 text-sm leading-relaxed text-ink-muted">
          Drop this around any call in this docs section — it retries once on a{" "}
          <code className="rounded bg-surface-2 px-1">429</code>, honoring the
          real <code className="rounded bg-surface-2 px-1">Retry-After</code>{" "}
          value instead of guessing a backoff.
        </p>
        <CodeTabs
          python={`import time
import httpx

def call_with_backoff(fn, *args, max_retries: int = 3, **kwargs) -> httpx.Response:
    for attempt in range(max_retries + 1):
        r = fn(*args, **kwargs)
        if r.status_code != 429 or attempt == max_retries:
            return r
        time.sleep(int(r.headers.get("Retry-After", "1")))
    return r  # unreachable, keeps type checkers happy

# usage
r = call_with_backoff(httpx.post, f"{API}/api/v1/ask", json={"question": "..."}, headers=headers)`}
          typescript={`async function callWithBackoff(
  input: string,
  init: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(input, init);
    if (res.status !== 429 || attempt === maxRetries) return res;
    const retryAfter = Number(res.headers.get("Retry-After") ?? "1");
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
  }
  throw new Error("unreachable");
}

// usage
const res = await callWithBackoff(\`\${API}/api/v1/ask\`, {
  method: "POST",
  headers: { ...authHeaders, "Content-Type": "application/json" },
  body: JSON.stringify({ question: "..." }),
});`}
          go={`func callWithBackoff(client *http.Client, req *http.Request, maxRetries int) (*http.Response, error) {
    for attempt := 0; attempt <= maxRetries; attempt++ {
        resp, err := client.Do(req)
        if err != nil || resp.StatusCode != 429 || attempt == maxRetries {
            return resp, err
        }
        retryAfter, _ := strconv.Atoi(resp.Header.Get("Retry-After"))
        if retryAfter == 0 {
            retryAfter = 1
        }
        time.Sleep(time.Duration(retryAfter) * time.Second)
    }
    return nil, fmt.Errorf("unreachable")
}`}
        />
      </GuideSection>

      <GuideSection title="Hosted-instance usage caps (not a self-host concern)">
        <p className="text-sm leading-relaxed text-ink-muted">
          Separately from rate limiting, a hosted Parlor instance may enforce a
          hard per-workspace lifetime cap on total meetings created — a guardrail
          against unbounded storage growth on a free, publicly-signup-able
          instance. This is <strong>opt-in and disabled by default</strong>: a
          self-hoster who never sets the relevant env var pays zero cost for
          this feature and has no limit at all.
        </p>
        <CodeBlock>{`{
  "error": {
    "code": "quota_exceeded",
    "message": "This hosted instance limits each workspace to 30 meetings — self-host Parlor for unlimited use.",
    "details": { "limit": 30, "current": 30 }
  }
}`}</CodeBlock>
        <p className="mt-3 text-sm text-ink-muted">
          The exact response above (limit value included) was captured from a
          live call against this project&apos;s own hosted instance.
        </p>
        <SourceNote>
          <code>backend/src/quota/guard.py</code>, <code>backend/src/quota/config.py</code>{" "}
          (<code>HOSTED_QUOTA_ENABLED</code> / <code>HOSTED_QUOTA_MAX_TOTAL_MEETINGS</code>)
        </SourceNote>
      </GuideSection>

      <GuideSection title="Self-hosting removes both">
        <p className="text-sm leading-relaxed text-ink-muted">
          Run Parlor yourself and the hosted-instance quota never applies — it
          only exists as an opt-in flag an operator could set, never a default.
          Per-request rate limits still apply (they protect your own instance
          from accidental abuse too) but every threshold above is tunable via
          env vars on your own deployment.
        </p>
      </GuideSection>
    </div>
  );
}
