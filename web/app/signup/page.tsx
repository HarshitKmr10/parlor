import type { Metadata } from "next";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { SignupForm } from "@/components/auth/SignupForm";
import { SsoButton } from "@/components/auth/SsoButton";

export const metadata: Metadata = {
  title: "Create your account — Verdant",
  description: "Start capturing and searching every meeting with Verdant.",
};

export default function SignupPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <AuthBrandPanel />
      <main className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="eyebrow mb-2">Get started</p>
            <h1 className="font-display text-2xl text-ink">
              Create your workspace
            </h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              Free to start. Your first meeting is on us.
            </p>
          </div>
          <SignupForm />
          <SsoButton />
        </div>
      </main>
    </div>
  );
}
