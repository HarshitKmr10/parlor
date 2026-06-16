import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { MeetingsIcon } from "@/components/ui/icons";

export default function MeetingNotFound() {
  return (
    <div className="mx-auto max-w-4xl">
      <EmptyState
        icon={<MeetingsIcon className="h-6 w-6" />}
        title="Meeting not found"
        description="This meeting doesn't exist, or it isn't part of your current workspace."
        action={
          <Link
            href="/meetings"
            className="rounded-md bg-sage-600 px-4 py-2.5 text-sm font-medium text-surface-cream shadow-soft-sm transition-colors hover:bg-sage-700"
          >
            Back to meetings
          </Link>
        }
      />
    </div>
  );
}
