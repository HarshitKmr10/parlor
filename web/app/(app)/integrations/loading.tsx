import { Skeleton } from "@/components/ui/Skeleton";

export default function IntegrationsLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-7">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-8 w-44" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
        <Skeleton className="mt-1 h-4 w-2/3 max-w-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
      <Skeleton className="mt-4 h-48 w-full" />
    </div>
  );
}
