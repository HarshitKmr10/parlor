import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set a new password — Parlor",
  description: "Choose a new password for your Parlor account.",
};

export default function ResetPasswordPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <AuthBrandPanel />
      <main className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="eyebrow mb-2">Password reset</p>
            <h1 className="font-display text-2xl text-ink">
              Choose a new password
            </h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              This link expires 30 minutes after it was requested.
            </p>
          </div>
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
