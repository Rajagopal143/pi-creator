import { PageLoader } from '@/components/app/PageLoader';

/** Catch-all loading UI for protected routes without a tailored loading.tsx
 *  (e.g. add/edit dealer, edit product). */
export default function ProtectedLoading() {
  return <PageLoader />;
}
