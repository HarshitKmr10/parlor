import type { Metadata } from "next";
import Link from "next/link";
import { listWebhooks, listWebhookEvents } from "@/lib/api/webhooks";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { WebhookEndpoint } from "@/lib/api/types";
import { WebhooksManager } from "@/components/settings/WebhooksManager";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Webhooks — Verdant",
};

export default async function WebhooksPage() {
  let endpoints: WebhookEndpoint[] = [];
  let eventTypes: string[] = [];
  let backendDown = false;
  try {
    const [eps, catalog] = await Promise.all([
      listWebhooks(),
      listWebhookEvents().catch(() => ({ eventTypes: [] })),
    ]);
    endpoints = eps;
    eventTypes = catalog.eventTypes;
  } catch (error: unknown) {
    if (ApiError.isApiError(error) && error.code === BACKEND_UNAVAILABLE_CODE) {
      backendDown = true;
    } else {
      throw error;
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <Link href="/settings" className="text-sm text-ink-muted hover:text-ink">
          ← Settings
        </Link>
        <p className="eyebrow mb-1.5 mt-3">Developer</p>
        <h1 className="font-display text-2xl text-ink">Webhooks</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Get notified the moment a transcript or summary is ready. Each delivery
          is HMAC-signed with the endpoint&apos;s secret and retried on failure.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="webhooks" />
      ) : (
        <WebhooksManager initialEndpoints={endpoints} eventTypes={eventTypes} />
      )}
    </div>
  );
}
