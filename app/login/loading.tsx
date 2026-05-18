import { Spinner } from '@/components/app/PageLoader';

/** Loading fallback for the login route — matches the dark login theme. */
export default function LoginLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-zinc-950">
      <Spinner className="h-10 w-10" />
    </div>
  );
}
