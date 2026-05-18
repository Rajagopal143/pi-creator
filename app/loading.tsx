import { Spinner } from '@/components/app/PageLoader';

/** Root-level loading fallback (e.g. while `/` resolves its redirect). */
export default function RootLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-zinc-100">
      <Spinner className="h-10 w-10" />
    </div>
  );
}
