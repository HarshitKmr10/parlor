import { isApiErrorBody } from "./error";

/**
 * Browser-side fetch helper for the Next route handlers (same-origin proxies).
 * Parses the `{ error: { code, message } }` envelope and throws a plain Error
 * with the contract message so client components can surface it inline.
 */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const data: unknown = text ? safeParse(text) : null;

  if (!response.ok) {
    if (isApiErrorBody(data)) throw new Error(data.error.message);
    throw new Error("Request failed. Please try again.");
  }
  return data as T;
}

/**
 * Browser-side GET against a same-origin route handler. Same error-envelope
 * handling as `postJson`. Supports an `AbortSignal` so callers (e.g. polling
 * loops) can cancel in-flight requests on unmount.
 */
export async function getJson<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });

  const text = await response.text();
  const data: unknown = text ? safeParse(text) : null;

  if (!response.ok) {
    if (isApiErrorBody(data)) throw new Error(data.error.message);
    throw new Error("Request failed. Please try again.");
  }
  return data as T;
}

/**
 * Browser-side PUT against a same-origin route handler. Same error-envelope
 * handling as `postJson`.
 */
export async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const data: unknown = text ? safeParse(text) : null;

  if (!response.ok) {
    if (isApiErrorBody(data)) throw new Error(data.error.message);
    throw new Error("Request failed. Please try again.");
  }
  return data as T;
}

/**
 * Browser-side PATCH against a same-origin route handler. Same error-envelope
 * handling as `postJson`.
 */
export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const data: unknown = text ? safeParse(text) : null;

  if (!response.ok) {
    if (isApiErrorBody(data)) throw new Error(data.error.message);
    throw new Error("Request failed. Please try again.");
  }
  return data as T;
}

/**
 * Browser-side DELETE against a same-origin route handler. Same error-envelope
 * handling as `postJson`. Returns the parsed body (or `undefined` on 204).
 */
export async function del<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: "DELETE" });

  const text = await response.text();
  const data: unknown = text ? safeParse(text) : null;

  if (!response.ok) {
    if (isApiErrorBody(data)) throw new Error(data.error.message);
    throw new Error("Request failed. Please try again.");
  }
  return data as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
