import { Skeleton } from "@/components/ui/Skeleton";

export default function ActionItemsLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-2 h-8 w-52" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
