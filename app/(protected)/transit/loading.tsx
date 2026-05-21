import { Skeleton, SkeletonTable } from '@/components/app/PageLoader';

/** Loading skeleton mirroring the in-transit list. */
export default function TransitLoading() {
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-10 flex-1 min-w-[160px]" />
          <Skeleton className="h-10 w-32 ml-auto" />
        </div>
        <SkeletonTable rows={6} cols={4} />
      </div>
    </div>
  );
}
