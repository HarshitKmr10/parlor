import "server-only";

import { apiFetch } from "./client";
import { API_PREFIX, PUBLIC_API_BASE_URL } from "./config";
import type { CalendarAccount, CalendarProvider } from "./types";

export function listCalendarAccounts(): Promise<CalendarAccount[]> {
  return apiFetch<CalendarAccount[]>("/calendar/accounts", {
    cache: "no-store",
  });
}

export function updateCalendarAccount(
  id: string,
  autoJoin: boolean,
): Promise<CalendarAccount> {
  return apiFetch<CalendarAccount>(`/calendar/accounts/${id}`, {
    method: "PATCH",
    body: { autoJoin },
  });
}

/**
 * The OAuth connect endpoints redirect (302) on the backend, so the browser
 * must navigate to them directly rather than fetch them. This builds the URL.
 */
export function calendarConnectUrl(provider: CalendarProvider): string {
  return `${PUBLIC_API_BASE_URL}${API_PREFIX}/calendar/connect/${provider}`;
}
