import { Skeleton, SkeletonTable } from '@/components/app/PageLoader';

/** Loading skeleton mirroring the dispatch queue layout. */
export default function DispatchLoading() {
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 flex-1 min-w-[200px]" />
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-32 ml-auto" />
          </div>
        </div>
        <SkeletonTable rows={8} cols={9} />
      </div>
    </div>
  );
}
