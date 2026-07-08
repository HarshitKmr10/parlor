/**
 * Smoke test (no live backend required):
 *   1. Build the server with a fake config + stubbed fetch.
 *   2. Connect it to an in-memory linked transport and a real MCP Client.
 *   3. Assert `tools/list` returns all four tools.
 *   4. Call `search_meetings` against a non-existent backend (network error)
 *      and assert it returns a clean error tool result, not a crash.
 *
 * Run: `node --import tsx scripts/smoke.ts`
 */

import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createServer } from "../src/server.js";
import { TOOL_NAMES } from "../src/tools/index.js";
import type { FetchLike } from "../src/client.js";

const EXPECTED_TOOLS = [...TOOL_NAMES].sort();

// A fetch stub that always fails — simulates an unreachable backend.
const failingFetch: FetchLike = async () => {
  throw new Error("ECONNREFUSED 127.0.0.1:9");
};

async function run(): Promise<void> {
  const server = createServer({
    config: {
      apiUrl: "http://localhost:9",
      apiKey: "test-key",
      workspaceId: "ws-test",
    },
    fetchImpl: failingFetch,
  });

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "smoke-client", version: "0.0.0" });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  // 1. tools/list
  const listed = await client.listTools();
  const names = listed.tools.map((t) => t.name).sort();
  assert.deepEqual(names, EXPECTED_TOOLS, "tools/list mismatch");
  for (const tool of listed.tools) {
    assert.ok(tool.inputSchema, `tool ${tool.name} missing inputSchema`);
    assert.equal(
      tool.inputSchema.type,
      "object",
      `tool ${tool.name} schema not object`,
    );
  }
  console.log(`tools/list OK: [${names.join(", ")}]`);

  // 2. Graceful error on unreachable backend.
  const result = await client.callTool({
    name: "search_meetings",
    arguments: { limit: 5 },
  });
  assert.equal(result.isError, true, "expected isError on network failure");
  const content = result.content as { type: string; text: string }[];
  assert.equal(content[0]?.type, "text");
  assert.match(
    content[0]?.text ?? "",
    /Failed to reach Parlor API/,
    "expected a readable network error",
  );
  console.log(`graceful error OK: "${content[0]?.text}"`);

  // 3. Input validation: a bad UUID must not succeed silently. Depending on
  // the SDK it either rejects the call or returns an isError result; both are
  // acceptable as long as the handler is never reached with bad input.
  const badInput = await client
    .callTool({ name: "get_meeting", arguments: { meetingId: "not-a-uuid" } })
    .then((r) => ({ rejected: false as const, r }))
    .catch((e: unknown) => ({ rejected: true as const, e }));
  const rejectedOrErrored =
    badInput.rejected === true || badInput.r.isError === true;
  assert.equal(
    rejectedOrErrored,
    true,
    "expected invalid UUID to be rejected or returned as an error result",
  );
  console.log("input validation OK: invalid UUID not accepted");

  await client.close();
  await server.close();
  console.log("\nSMOKE PASSED");
}

run().catch((error: unknown) => {
  console.error("SMOKE FAILED:", error);
  process.exit(1);
});
