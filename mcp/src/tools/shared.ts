/**
 * Shared helpers for tool handlers: turn results / errors into MCP tool result
 * content. Errors are surfaced as `isError` tool results, never thrown, so a
 * misbehaving backend degrades gracefully instead of crashing the server.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ApiError } from "../client.js";

/** Tool handler return type — the SDK's structured tool result. */
export type ToolResult = CallToolResult;

export function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function errorResult(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

/** Convert any thrown value into a readable, user-facing error string. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return error.message;
    if (error.status === 401 || error.status === 403) {
      return `Authentication failed (${error.code}): ${error.message}. Check VERDANT_API_KEY and VERDANT_WORKSPACE_ID.`;
    }
    if (error.status === 404) {
      return `Not found (${error.code}): ${error.message}`;
    }
    return `Verdant API error ${error.status} (${error.code}): ${error.message}`;
  }
  if (error instanceof Error) return error.message;
  return `Unexpected error: ${String(error)}`;
}

/**
 * Run a handler and translate thrown errors into an error tool result.
 * Keeps every tool handler crash-safe with one wrapper.
 */
export async function safeRun(
  fn: () => Promise<ToolResult>,
): Promise<ToolResult> {
  try {
    return await fn();
  } catch (error) {
    return errorResult(describeError(error));
  }
}
