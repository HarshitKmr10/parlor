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

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Reject a base URL that would send the workspace API key over plaintext http.
 * Loopback hosts are allowed so local development against a dev backend still
 * works. Anything else must be https.
 */
function requireSecureUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ConfigError(
      `PARLOR_API_URL is not a valid URL: ${JSON.stringify(value)}`,
    );
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" && !LOOPBACK_HOSTS.has(host)) {
    throw new ConfigError(
      `PARLOR_API_URL must use https:// (got ${parsed.protocol}//${host}). ` +
        "The workspace API key is sent on every request; plaintext http would " +
        "leak it. Use https, or a loopback host for local development.",
    );
  }
  return value;
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
    apiUrl: stripTrailingSlash(requireSecureUrl(rawUrl)),
    apiKey,
    workspaceId: workspaceId && workspaceId.length > 0 ? workspaceId : undefined,
  };
}
