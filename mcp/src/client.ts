/**
 * Typed HTTP client over the Verdant backend product API (v1).
 *
 * Authenticates with the workspace API key via the `X-API-Key` header (the
 * documented alternative to Bearer JWT) and unwraps the
 * `{ error: { code, message } }` error envelope into a typed {@link ApiError}.
 */

import type { VerdantConfig } from "./config.js";
import type {
  AskResponse,
  ApiErrorEnvelope,
  Meeting,
  MeetingDetail,
  MeetingStatus,
  Paginated,
  TranscriptResponse,
} from "./types.js";

/** Network / transport / non-2xx failures, carrying the backend error code. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Minimal fetch signature so tests can inject a stub. */
export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface ListMeetingsParams {
  readonly status?: MeetingStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ClientOptions {
  readonly config: VerdantConfig;
  /** Defaults to the global `fetch`. Override for tests. */
  readonly fetchImpl?: FetchLike;
  /** Request timeout in milliseconds. Defaults to 30s. */
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const env = value as { error?: unknown };
  if (typeof env.error !== "object" || env.error === null) return false;
  const err = env.error as { code?: unknown; message?: unknown };
  return typeof err.code === "string" && typeof err.message === "string";
}

export class VerdantClient {
  private readonly config: VerdantConfig;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: ClientOptions) {
    this.config = options.config;
    const injected = options.fetchImpl;
    // Bind so the global fetch keeps its expected `this`.
    this.fetchImpl =
      injected ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async listMeetings(params: ListMeetingsParams = {}): Promise<Paginated<Meeting>> {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (typeof params.limit === "number") query.set("limit", String(params.limit));
    if (typeof params.offset === "number") query.set("offset", String(params.offset));
    const qs = query.toString();
    return this.request<Paginated<Meeting>>(
      "GET",
      `/api/v1/meetings${qs ? `?${qs}` : ""}`,
    );
  }

  async getMeeting(meetingId: string): Promise<MeetingDetail> {
    return this.request<MeetingDetail>(
      "GET",
      `/api/v1/meetings/${encodeURIComponent(meetingId)}`,
    );
  }

  async getTranscript(
    meetingId: string,
    since?: string,
  ): Promise<TranscriptResponse> {
    const qs = since ? `?since=${encodeURIComponent(since)}` : "";
    return this.request<TranscriptResponse>(
      "GET",
      `/api/v1/meetings/${encodeURIComponent(meetingId)}/transcript${qs}`,
    );
  }

  async askMeeting(meetingId: string, question: string): Promise<AskResponse> {
    return this.request<AskResponse>(
      "POST",
      `/api/v1/meetings/${encodeURIComponent(meetingId)}/ask`,
      { question },
    );
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.config.apiUrl}${path}`;
    const headers: Record<string, string> = {
      "X-API-Key": this.config.apiKey,
      Accept: "application/json",
    };
    if (this.config.workspaceId) {
      headers["X-Workspace-Id"] = this.config.workspaceId;
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      const init: RequestInit = { method, headers, signal: controller.signal };
      if (body !== undefined) init.body = JSON.stringify(body);
      response = await this.fetchImpl(url, init);
    } catch (cause) {
      const reason =
        cause instanceof Error && cause.name === "AbortError"
          ? `Request timed out after ${this.timeoutMs}ms`
          : cause instanceof Error
            ? cause.message
            : "Unknown network error";
      throw new ApiError(
        `Failed to reach Verdant API at ${url}: ${reason}`,
        "network_error",
        0,
        cause,
      );
    } finally {
      clearTimeout(timer);
    }

    return this.parse<T>(response, url);
  }

  private async parse<T>(response: Response, url: string): Promise<T> {
    const text = await response.text();
    let parsed: unknown = undefined;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        if (!response.ok) {
          throw new ApiError(
            `Verdant API ${response.status} at ${url}: ${text.slice(0, 200)}`,
            "http_error",
            response.status,
          );
        }
        throw new ApiError(
          `Verdant API returned non-JSON body at ${url}`,
          "invalid_response",
          response.status,
        );
      }
    }

    if (!response.ok) {
      if (isErrorEnvelope(parsed)) {
        throw new ApiError(
          parsed.error.message,
          parsed.error.code,
          response.status,
          parsed.error.details,
        );
      }
      throw new ApiError(
        `Verdant API ${response.status} at ${url}`,
        "http_error",
        response.status,
      );
    }

    return parsed as T;
  }
}
