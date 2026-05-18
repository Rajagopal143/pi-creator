import { Skeleton, SkeletonTable } from '@/components/app/PageLoader';

/** Loading skeleton mirroring the invoices list (filter card + table). */
export default function InvoicesLoading() {
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <Skeleton className="h-4 w-32" />
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 flex-1 min-w-[200px]" />
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
        <SkeletonTable rows={8} cols={9} />
      </div>
    </div>
  );
}
