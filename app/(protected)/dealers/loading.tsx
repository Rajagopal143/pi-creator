import { Skeleton, SkeletonTable } from '@/components/app/PageLoader';

/** Loading skeleton mirroring the dealers list (search bar + table). */
export default function DealersLoading() {
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-10 flex-1 max-w-sm" />
          <Skeleton className="h-10 w-32" />
        </div>
        <SkeletonTable rows={8} cols={7} />
      </div>
    </div>
  );
}
