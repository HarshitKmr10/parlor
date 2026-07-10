import { Skeleton } from "@/components/ui/Skeleton";

export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mb-4 mt-2 h-8 w-72" />
        <Skeleton className="h-11 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
