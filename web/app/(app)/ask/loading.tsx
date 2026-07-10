import { Skeleton } from "@/components/ui/Skeleton";

export default function AskLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-7">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-2 h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
        <Skeleton className="mt-1 h-4 w-2/3 max-w-xl" />
      </div>
      <Skeleton className="mb-10 h-32 w-full" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}
