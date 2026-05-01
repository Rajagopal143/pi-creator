import Link from 'next/link';
import { listDealersForAdminAction } from '@/lib/dealers/server-actions';
import { ImportDealersButton } from './ImportDealersButton';
import { Button } from '@/components/ui/button';
import { USER_TYPE_LABELS, type DealerUserType } from '@/lib/dealers/referenceData';

export const metadata = {
  title: 'Dealers — Yakuza DMS',
};

export default async function DealersPage() {
  const dealers = await listDealersForAdminAction();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Dealers</h2>
          <p className="text-sm text-muted-foreground">
            Manage dealers in MongoDB. Import the bundled CSV or add manually.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link href="/dealers/add">Add New Dealer</Link>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Firm</th>
                <th className="px-4 py-3">User type</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Contact</th>
              </tr>
            </thead>
            <tbody>
              {dealers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No dealers in database yet. Import CSV or add a dealer.
                  </td>
                </tr>
              ) : (
                dealers.map(d => (
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{d.dealerId}</td>
                    <td className="px-4 py-3 font-medium">{d.orgName}</td>
                    <td className="px-4 py-3 text-xs">
                      {USER_TYPE_LABELS[d.userType as DealerUserType] ?? d.userType}
                    </td>
                    <td className="px-4 py-3 text-xs">{d.orgEmail}</td>
                    <td className="px-4 py-3 text-xs">{d.contact}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
