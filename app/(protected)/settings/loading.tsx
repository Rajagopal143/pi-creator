import { SkeletonCard } from '@/components/app/PageLoader';

/** Loading skeleton mirroring the settings page (stacked counter cards). */
export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <SkeletonCard rows={1} />
        <SkeletonCard rows={2} />
        <SkeletonCard rows={2} />
        <SkeletonCard rows={2} />
      </div>
    </div>
  );
}
