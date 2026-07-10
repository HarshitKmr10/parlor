import { Skeleton } from "@/components/ui/Skeleton";

export default function TrackersLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-2 h-8 w-36" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
        <Skeleton className="mt-1 h-4 w-2/3 max-w-xl" />
      </div>
      <Skeleton className="h-40 w-full" />
      <div className="mt-9">
        <Skeleton className="mb-3 h-6 w-32" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}
