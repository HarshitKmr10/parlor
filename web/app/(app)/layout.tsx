import { redirect } from "next/navigation";
import { getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { AppShell } from "@/components/app-shell/AppShell";
import { OfflineShell } from "@/components/app-shell/OfflineShell";
import type { MeResponse } from "@/lib/api/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let me: MeResponse;
  try {
    me = await getMe();
  } catch (error: unknown) {
    // Backend down: render a minimal shell so the app doesn't crash.
    if (ApiError.isApiError(error) && error.code === BACKEND_UNAVAILABLE_CODE) {
      return <OfflineShell>{children}</OfflineShell>;
    }
    // 401/expired and refresh failed -> middleware normally catches this, but
    // guard here too for direct hits.
    if (ApiError.isApiError(error) && error.status === 401) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <AuthProvider
      user={me.user}
      workspaces={me.workspaces}
      currentWorkspace={me.currentWorkspace}
    >
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
