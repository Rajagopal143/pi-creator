import { SkeletonCard } from '@/components/app/PageLoader';

/** Loading skeleton mirroring the PI creator's stacked card layout. */
export default function CreatePILoading() {
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <SkeletonCard rows={2} />
        <SkeletonCard rows={2} />
        <SkeletonCard rows={3} />
        <SkeletonCard rows={4} />
        <SkeletonCard rows={3} />
      </div>
    </div>
  );
}
