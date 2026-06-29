import type { Metadata } from "next";
import Link from "next/link";
import { getBilling } from "@/lib/api/billing";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { BillingStatus } from "@/lib/api/types";
import { BillingPanel } from "@/components/settings/BillingPanel";
import { BackendDownState } from "@/components/ui/BackendDownState";

export const metadata: Metadata = {
  title: "Billing — Verdant",
};

export default async function BillingPage() {
  let billing: BillingStatus | null = null;
  let backendDown = false;
  try {
    billing = await getBilling();
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
        <p className="eyebrow mb-1.5 mt-3">Plan</p>
        <h1 className="font-display text-2xl text-ink">Billing</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Manage your plan and see this month&apos;s usage.
        </p>
      </header>

      {backendDown || !billing ? (
        <BackendDownState resource="billing" />
      ) : (
        <BillingPanel initial={billing} />
      )}
    </div>
  );
}
