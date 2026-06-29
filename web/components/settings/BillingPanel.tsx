"use client";

import { useState } from "react";
import { postJson } from "@/lib/api/browser";
import type { BillingStatus } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";

export function BillingPanel({ initial }: { initial: BillingStatus }) {
  const [billing, setBilling] = useState<BillingStatus>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upgrade = async (plan: "pro" | "business") => {
    setBusy(plan);
    setError(null);
    try {
      const res = await postJson<BillingStatus & { redirectUrl?: string }>(
        "/api/billing/checkout",
        { plan },
      );
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl; // live Stripe
        return;
      }
      setBilling(res); // dev mock upgrade
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      setBusy(null);
    }
  };

  const quotaLabel =
    billing.meetingQuota == null ? "Unlimited" : `${billing.meetingsThisMonth} / ${billing.meetingQuota}`;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-border-subtle bg-surface-0 p-5 shadow-soft-sm">
        <p className="eyebrow mb-1">Current plan</p>
        <div className="flex items-baseline gap-3">
          <span className="font-display text-2xl capitalize text-ink">{billing.plan}</span>
          <span className="rounded-full bg-sage-50 px-2 py-0.5 text-xs font-semibold text-sage-700">
            {billing.status}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          Meetings this month: <span className="font-medium text-ink">{quotaLabel}</span>
        </p>
      </section>

      {error && <p className="text-sm text-error">{error}</p>}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {billing.plans.map((p) => {
          const isCurrent = p.key === billing.plan;
          return (
            <div
              key={p.key}
              className={`flex flex-col rounded-lg border p-4 shadow-soft-sm ${
                isCurrent ? "border-sage-500 bg-sage-50/40" : "border-border-subtle bg-surface-0"
              }`}
            >
              <p className="font-display text-lg text-ink">{p.name}</p>
              <p className="mt-1 text-2xl font-semibold text-ink">
                ${p.priceUsd}
                <span className="text-sm font-normal text-ink-muted">/mo</span>
              </p>
              <ul className="mt-3 flex flex-1 flex-col gap-1 text-xs text-ink-muted">
                <li>{p.meetingsPerMonth == null ? "Unlimited meetings" : `${p.meetingsPerMonth} meetings / mo`}</li>
                <li>Up to {p.seats} seats</li>
              </ul>
              <div className="mt-4">
                {isCurrent ? (
                  <span className="text-xs font-medium text-sage-700">Current plan</span>
                ) : p.key === "free" ? (
                  <span className="text-xs text-ink-faint">—</span>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => upgrade(p.key as "pro" | "business")}
                    disabled={busy !== null}
                  >
                    {busy === p.key ? "Upgrading…" : `Upgrade to ${p.name}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
