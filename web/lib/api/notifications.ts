import "server-only";

import { apiFetch } from "./client";
import type { NotificationListResponse } from "./types";

export function listNotifications(
  params: { unreadOnly?: boolean; limit?: number } = {},
): Promise<NotificationListResponse> {
  const search = new URLSearchParams();
  if (params.unreadOnly) search.set("unreadOnly", "true");
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiFetch<NotificationListResponse>(
    `/notifications${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  );
}

export function markNotificationRead(id: string): Promise<void> {
  return apiFetch<void>(`/notifications/${id}/read`, { method: "POST" });
}

export function markAllNotificationsRead(): Promise<void> {
  return apiFetch<void>("/notifications/read-all", { method: "POST" });
}
