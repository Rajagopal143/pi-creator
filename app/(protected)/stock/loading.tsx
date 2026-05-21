import { Skeleton, SkeletonTable } from '@/components/app/PageLoader';

/** Loading skeleton mirroring the stock page (per-MU table groups). */
export default function StockLoading() {
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-10 w-44" />
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
              <Skeleton className="h-4 w-56" />
            </div>
            <SkeletonTable rows={4} cols={6} />
          </div>
        ))}
      </div>
    </div>
  );
}
