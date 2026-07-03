import type { Metadata } from "next";
import { listWorkspaceActionItems } from "@/lib/api/action-items";
import { ApiError } from "@/lib/api/error";
import { BACKEND_UNAVAILABLE_CODE } from "@/lib/api/client";
import type { ActionItemRecord } from "@/lib/api/types";
import { ActionItemsBoard } from "@/components/action-items/ActionItemsBoard";
import { EmptyState } from "@/components/ui/EmptyState";
import { BackendDownState } from "@/components/ui/BackendDownState";
import { TasksIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Action items — Parlor",
};

export default async function ActionItemsPage() {
  let items: ActionItemRecord[] = [];
  let backendDown = false;
  try {
    const res = await listWorkspaceActionItems();
    items = res.items;
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
        <p className="eyebrow mb-1.5">Tracker</p>
        <h1 className="font-display text-2xl text-ink">Action items</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every commitment from every meeting, in one place.
        </p>
      </header>

      {backendDown ? (
        <BackendDownState resource="your action items" />
      ) : items.length > 0 ? (
        <ActionItemsBoard initialItems={items} />
      ) : (
        <EmptyState
          icon={<TasksIcon className="h-6 w-6" />}
          title="No action items yet"
          description="As Parlor summarizes your meetings, the commitments it detects collect here so nothing slips."
        />
      )}
    </div>
  );
}
