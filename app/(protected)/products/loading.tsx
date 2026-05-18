import { Skeleton, SkeletonTable } from '@/components/app/PageLoader';

/** Loading skeleton mirroring the products list (search bar + table). */
export default function ProductsLoading() {
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-64" />
        </div>
        <SkeletonTable rows={8} cols={8} />
      </div>
    </div>
  );
}
