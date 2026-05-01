'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { importDealersFromCsvAction } from '@/lib/dealers/server-actions';

type ImportDealersButtonProps = {
  onImported?: () => void;
};

export function ImportDealersButton({ onImported }: ImportDealersButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage('');
            const r = await importDealersFromCsvAction();
            setMessage(r.message);
            onImported?.();
            router.refresh();
          })
        }
      >
        {pending ? 'Importing…' : 'Import dealers from CSV'}
      </Button>
      {message ? <p className="max-w-xs text-right text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
