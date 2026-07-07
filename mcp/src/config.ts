/**
 * Runtime configuration sourced from environment variables. Fails fast with a
 * clear message when the workspace API key is missing.
 */

const DEFAULT_API_URL = "http://localhost:8000";

export interface ParlorConfig {
  /** Backend base URL, no trailing slash (e.g. http://localhost:8000). */
  readonly apiUrl: string;
  /** Workspace API key sent as the `X-API-Key` header. */
  readonly apiKey: string;
  /** Optional workspace id sent as the `X-Workspace-Id` header. */
  readonly workspaceId: string | undefined;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.replace(/\/+$/, "") : value;
}

/**
 * Build config from `process.env`. Throws {@link ConfigError} when required
 * values are absent so the process exits with an actionable message instead of
 * failing later mid-request.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ParlorConfig {
  const apiKey = env.PARLOR_API_KEY?.trim();
  if (!apiKey) {
    throw new ConfigError(
      "PARLOR_API_KEY is required. Set it to a workspace API key " +
        "(create one via the Parlor app: Settings → API Keys). " +
        "Example: PARLOR_API_KEY=vk_live_... parlor-mcp",
    );
  }

  const rawUrl = env.PARLOR_API_URL?.trim() || DEFAULT_API_URL;
  const workspaceId = env.PARLOR_WORKSPACE_ID?.trim();

  return {
    apiUrl: stripTrailingSlash(rawUrl),
    apiKey,
    workspaceId: workspaceId && workspaceId.length > 0 ? workspaceId : undefined,
  };
}
