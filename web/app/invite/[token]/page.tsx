import type { Metadata } from "next";
import Link from "next/link";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { InviteAcceptForm } from "@/components/auth/InviteAcceptForm";
import { previewInvite } from "@/lib/api/invites";
import { getMe } from "@/lib/api/auth";
import type { InvitePreview } from "@/lib/api/types";

export const metadata: Metadata = {
  title: "Join a workspace — Parlor",
};

async function loadPreview(token: string): Promise<InvitePreview | null> {
  try {
    return await previewInvite(token);
  } catch {
    return null;
  }
}

async function loadSignedInEmail(): Promise<string | null> {
  try {
    const me = await getMe();
    return me.user.email;
  } catch {
    return null;
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <AuthBrandPanel />
      <main className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [preview, signedInEmail] = await Promise.all([
    loadPreview(token),
    loadSignedInEmail(),
  ]);

  if (!preview) {
    return (
      <Shell>
        <div className="mb-8">
          <p className="eyebrow mb-2">Invite</p>
          <h1 className="font-display text-2xl text-ink">
            This invite isn&rsquo;t valid
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            It may have expired, been revoked, or already been used. Ask
            whoever invited you to send a new one.
          </p>
        </div>
        <Link
          href="/login"
          className="font-medium text-sage-700 underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      </Shell>
    );
  }

  const isSignedInAsInvitee =
    !!signedInEmail &&
    signedInEmail.toLowerCase() === preview.email.toLowerCase();

  if (!preview.requiresSignup && !isSignedInAsInvitee) {
    return (
      <Shell>
        <div className="mb-8">
          <p className="eyebrow mb-2">Invite</p>
          <h1 className="font-display text-2xl text-ink">
            Join {preview.workspaceName}
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            This invite is for <strong>{preview.email}</strong>, which already
            has a Parlor account. Sign in with that account to accept.
          </p>
        </div>
        <Link
          href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
          className="inline-flex w-full items-center justify-center rounded-md bg-sage-600 px-4 py-2.5 text-sm font-medium text-surface-cream shadow-soft-sm transition-colors hover:bg-sage-700"
        >
          Sign in to accept
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-8">
        <p className="eyebrow mb-2">Invite</p>
        <h1 className="font-display text-2xl text-ink">
          Join {preview.workspaceName}
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          {preview.requiresSignup
            ? `You've been invited as ${preview.role} — create your account to join.`
            : `Accept as ${preview.email} to join as ${preview.role}.`}
        </p>
      </div>
      <InviteAcceptForm token={token} requiresSignup={preview.requiresSignup} />
    </Shell>
  );
}
