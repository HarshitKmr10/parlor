import { Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-7 flex items-end justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
      <div className="mt-8 space-y-3">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
