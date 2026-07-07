import type { Metadata } from "next";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password — Parlor",
  description: "Request a password reset link for your Parlor account.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <AuthBrandPanel />
      <main className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="eyebrow mb-2">Password reset</p>
            <h1 className="font-display text-2xl text-ink">
              Forgot your password?
            </h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              Enter your account email and we&rsquo;ll send you a link to
              reset it.
            </p>
          </div>
          <ForgotPasswordForm />
        </div>
      </main>
    </div>
  );
}
