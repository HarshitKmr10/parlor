import type { Metadata } from "next";
import { GuideHeader, GuideSection, SourceNote } from "@/components/developers/GuideChrome";
import { CodeTabs } from "@/components/developers/CodeTabs";

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
        <CodeTabs
          curl={`curl -s -X POST $API/api/v1/auth/signup \\
  -H 'Content-Type: application/json' \\
  -d '{
    "email": "you@example.com",
    "password": "a-strong-password",
    "name": "Your Name",
    "workspaceName": "Your Workspace"
  }'`}
          python={`import httpx

r = httpx.post(f"{API}/api/v1/auth/signup", json={
    "email": "you@example.com",
    "password": "a-strong-password",
    "name": "Your Name",
    "workspaceName": "Your Workspace",
})
r.raise_for_status()
auth = r.json()
token = auth["accessToken"]
workspace_id = auth["workspace"]["id"]`}
          typescript={`const res = await fetch(\`\${API}/api/v1/auth/signup\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "you@example.com",
    password: "a-strong-password",
    name: "Your Name",
    workspaceName: "Your Workspace",
  }),
});
const auth = await res.json();
const { accessToken } = auth;
const workspaceId = auth.workspace.id;`}
          go={`body, _ := json.Marshal(map[string]string{
    "email":         "you@example.com",
    "password":      "a-strong-password",
    "name":          "Your Name",
    "workspaceName": "Your Workspace",
})
resp, err := http.Post(api+"/api/v1/auth/signup", "application/json", bytes.NewReader(body))
if err != nil {
    log.Fatal(err)
}
defer resp.Body.Close()

var auth struct {
    AccessToken string \`json:"accessToken"\`
    Workspace   struct {
        ID string \`json:"id"\`
    } \`json:"workspace"\`
}
json.NewDecoder(resp.Body).Decode(&auth)`}
        />
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
        <CodeTabs
          curl={`curl -s -X POST $API/api/v1/meetings/botless \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID" \\
  -H 'Content-Type: application/json' \\
  -d '{"title": "Roadmap sync", "source": "desktop"}'`}
          python={`r = httpx.post(
    f"{API}/api/v1/meetings/botless",
    json={"title": "Roadmap sync", "source": "desktop"},
    headers={"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id},
)
r.raise_for_status()
meeting_id = r.json()["id"]`}
          typescript={`const authHeaders = {
  Authorization: \`Bearer \${accessToken}\`,
  "X-Workspace-Id": workspaceId,
};

const meetingRes = await fetch(\`\${API}/api/v1/meetings/botless\`, {
  method: "POST",
  headers: { ...authHeaders, "Content-Type": "application/json" },
  body: JSON.stringify({ title: "Roadmap sync", source: "desktop" }),
});
const meeting = await meetingRes.json();
const meetingId = meeting.id;`}
          go={`body, _ := json.Marshal(map[string]string{"title": "Roadmap sync", "source": "desktop"})
req, _ := http.NewRequest("POST", api+"/api/v1/meetings/botless", bytes.NewReader(body))
req.Header.Set("Authorization", "Bearer "+token)
req.Header.Set("X-Workspace-Id", workspaceID)
req.Header.Set("Content-Type", "application/json")

resp, err := http.DefaultClient.Do(req)
if err != nil {
    log.Fatal(err)
}
defer resp.Body.Close()

var meeting struct {
    ID string \`json:"id"\`
}
json.NewDecoder(resp.Body).Decode(&meeting)`}
        />
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
        <CodeTabs
          curl={`curl -s -X POST $API/api/v1/meetings/$MEETING_ID/transcript \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID" \\
  -H 'Content-Type: application/json' \\
  -d '{"segments": [
    {"id": "...", "speakerName": "Alex", "text": "Let'"'"'s review Q3.",
     "tStartSec": 0, "tEndSec": 4, "createdAt": "2026-01-01T00:00:00Z"}
  ]}'`}
          python={`import uuid
from datetime import datetime, timezone

r = httpx.post(
    f"{API}/api/v1/meetings/{meeting_id}/transcript",
    json={"segments": [{
        "id": str(uuid.uuid4()),
        "speakerName": "Alex",
        "text": "Let's review Q3.",
        "tStartSec": 0,
        "tEndSec": 4,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }]},
    headers={"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id},
)
r.raise_for_status()`}
          typescript={`await fetch(\`\${API}/api/v1/meetings/\${meetingId}/transcript\`, {
  method: "POST",
  headers: { ...authHeaders, "Content-Type": "application/json" },
  body: JSON.stringify({
    segments: [{
      id: crypto.randomUUID(),
      speakerName: "Alex",
      text: "Let's review Q3.",
      tStartSec: 0,
      tEndSec: 4,
      createdAt: new Date().toISOString(),
    }],
  }),
});`}
          go={`// requires "github.com/google/uuid"
segments := []map[string]any{{
    "id":          uuid.NewString(),
    "speakerName": "Alex",
    "text":        "Let's review Q3.",
    "tStartSec":   0,
    "tEndSec":     4,
    "createdAt":   time.Now().UTC().Format(time.RFC3339),
}}
body, _ := json.Marshal(map[string]any{"segments": segments})
req, _ := http.NewRequest("POST", api+"/api/v1/meetings/"+meetingID+"/transcript", bytes.NewReader(body))
req.Header.Set("Authorization", "Bearer "+token)
req.Header.Set("X-Workspace-Id", workspaceID)
req.Header.Set("Content-Type", "application/json")
http.DefaultClient.Do(req)`}
        />
        <SourceNote>
          <code>docs/API-CONTRACT.md</code>, <code>cookbook/01-botless-capture/run.py</code>
        </SourceNote>
      </GuideSection>

      <GuideSection title="4. Complete the meeting, then read the summary">
        <CodeTabs
          curl={`curl -s -X POST $API/api/v1/meetings/$MEETING_ID/complete \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID"

curl -s -X POST $API/api/v1/meetings/$MEETING_ID/summarize \\
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WORKSPACE_ID"`}
          python={`headers = {"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id}

httpx.post(f"{API}/api/v1/meetings/{meeting_id}/complete", headers=headers).raise_for_status()

r = httpx.post(f"{API}/api/v1/meetings/{meeting_id}/summarize", headers=headers)
print(r.json()["summary"])`}
          typescript={`await fetch(\`\${API}/api/v1/meetings/\${meetingId}/complete\`, {
  method: "POST",
  headers: authHeaders,
});

const summaryRes = await fetch(\`\${API}/api/v1/meetings/\${meetingId}/summarize\`, {
  method: "POST",
  headers: authHeaders,
});
const { summary } = await summaryRes.json();
console.log(summary);`}
          go={`complete, _ := http.NewRequest("POST", api+"/api/v1/meetings/"+meetingID+"/complete", nil)
complete.Header.Set("Authorization", "Bearer "+token)
complete.Header.Set("X-Workspace-Id", workspaceID)
http.DefaultClient.Do(complete)

summarize, _ := http.NewRequest("POST", api+"/api/v1/meetings/"+meetingID+"/summarize", nil)
summarize.Header.Set("Authorization", "Bearer "+token)
summarize.Header.Set("X-Workspace-Id", workspaceID)
resp, _ := http.DefaultClient.Do(summarize)
defer resp.Body.Close()

var out struct {
    Summary string \`json:"summary"\`
}
json.NewDecoder(resp.Body).Decode(&out)
fmt.Println(out.Summary)`}
        />
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
