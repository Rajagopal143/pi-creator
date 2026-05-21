import { Skeleton, SkeletonCard } from '@/components/app/PageLoader';

/** Loading skeleton for the add-product form (details + variants cards). */
export default function NewProductLoading() {
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <SkeletonCard rows={4} />
        <SkeletonCard rows={5} />
      </div>
    </div>
  );
}
