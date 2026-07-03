#!/usr/bin/env node
/**
 * Parlor MCP server — stdio transport.
 *
 * Exposes the workspace meeting knowledge base (search_meetings, get_meeting,
 * get_transcript, ask_meetings) over MCP, backed by the Parlor product API and
 * authenticated with a workspace API key (`X-API-Key`).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig, ConfigError, type VerdantConfig } from "./config.js";
import { VerdantClient, type FetchLike } from "./client.js";
import { registerTools } from "./tools/index.js";

const SERVER_NAME = "parlor-mcp";
const SERVER_VERSION = "0.1.0";

export interface CreateServerOptions {
  readonly config: VerdantConfig;
  /** Inject a fetch stub for tests. */
  readonly fetchImpl?: FetchLike;
}

/**
 * Build a fully wired McpServer (no transport connected). Pure enough to be
 * exercised by smoke tests.
 */
export function createServer(options: CreateServerOptions): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const clientOptions = options.fetchImpl
    ? { config: options.config, fetchImpl: options.fetchImpl }
    : { config: options.config };
  const client = new VerdantClient(clientOptions);

  registerTools(server, client);
  return server;
}

async function main(): Promise<void> {
  let config: VerdantConfig;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`[parlor-mcp] ${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  const server = createServer({ config });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[parlor-mcp] connected (api=${config.apiUrl}, workspace=${config.workspaceId ?? "default"})\n`,
  );
}

// Only auto-start when run as the entrypoint, not when imported by tests.
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (invokedDirectly) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[parlor-mcp] fatal: ${message}\n`);
    process.exit(1);
  });
}
