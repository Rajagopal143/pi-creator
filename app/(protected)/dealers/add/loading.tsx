import { Skeleton, SkeletonCard } from '@/components/app/PageLoader';

/** Loading skeleton for the add-dealer form. */
export default function AddDealerLoading() {
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <Skeleton className="h-6 w-44" />
        <SkeletonCard rows={4} />
        <SkeletonCard rows={5} />
        <SkeletonCard rows={3} />
      </div>
    </div>
  );
}
