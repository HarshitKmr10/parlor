import { Skeleton } from "@/components/ui/Skeleton";

export default function ReportsLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-2 h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-40" />
      </div>
      <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="mb-7">
        <Skeleton className="mb-3 h-6 w-32" />
        <Skeleton className="h-40 w-full" />
      </div>
      <div>
        <Skeleton className="mb-3 h-6 w-48" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}
