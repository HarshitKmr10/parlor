import { Skeleton } from "@/components/ui/Skeleton";

export default function MeetingDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-9 w-2/3" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <Skeleton className="mt-5 h-14 w-full" />
      <Skeleton className="mt-8 h-10 w-72" />
      <Skeleton className="mt-6 h-72 w-full" />
    </div>
  );
}
