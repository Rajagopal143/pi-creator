'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { importDealersFromCsvAction } from '@/lib/dealers/server-actions';

type ImportDealersButtonProps = {
  onImported?: () => void;
};

export function ImportDealersButton({ onImported }: ImportDealersButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const r = await importDealersFromCsvAction();
            toast.success(r.message || 'Dealers imported from CSV.');
            onImported?.();
            router.refresh();
          } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to import dealers');
          }
        })
      }
    >
      {pending ? 'Importing…' : 'Import dealers from CSV'}
    </Button>
  );
}
