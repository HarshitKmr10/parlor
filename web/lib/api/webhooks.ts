import "server-only";

import { apiFetch } from "./client";
import type {
  CreateWebhookInput,
  WebhookDeliveryListResponse,
  WebhookEndpoint,
  WebhookEventCatalog,
} from "./types";

export function listWebhooks(): Promise<WebhookEndpoint[]> {
  return apiFetch<WebhookEndpoint[]>("/webhooks", { cache: "no-store" });
}

export function listWebhookEvents(): Promise<WebhookEventCatalog> {
  return apiFetch<WebhookEventCatalog>("/webhooks/events", { cache: "no-store" });
}

export function createWebhook(input: CreateWebhookInput): Promise<WebhookEndpoint> {
  return apiFetch<WebhookEndpoint>("/webhooks", { method: "POST", body: input });
}

export function updateWebhook(
  id: string,
  input: { enabled?: boolean; url?: string; description?: string; eventTypes?: string[] },
): Promise<WebhookEndpoint> {
  return apiFetch<WebhookEndpoint>(`/webhooks/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteWebhook(id: string): Promise<void> {
  return apiFetch<void>(`/webhooks/${id}`, { method: "DELETE" });
}

export function testWebhook(id: string): Promise<unknown> {
  return apiFetch(`/webhooks/${id}/test`, { method: "POST" });
}

export function listWebhookDeliveries(
  id: string,
): Promise<WebhookDeliveryListResponse> {
  return apiFetch<WebhookDeliveryListResponse>(`/webhooks/${id}/deliveries`, {
    cache: "no-store",
  });
}
