import { Skeleton, SkeletonTable } from '@/components/app/PageLoader';

/** Loading skeleton mirroring the payments ledger. */
export default function PaymentsLoading() {
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-40 rounded-full" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
        <SkeletonTable rows={8} cols={9} />
      </div>
    </div>
  );
}
