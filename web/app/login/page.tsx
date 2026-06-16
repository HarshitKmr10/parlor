import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in — Verdant",
  description: "Sign in to your Verdant workspace.",
};

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <AuthBrandPanel />
      <main className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="eyebrow mb-2">Welcome back</p>
            <h1 className="font-display text-2xl text-ink">
              Sign in to Verdant
            </h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              Pick up right where your meetings left off.
            </p>
          </div>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
