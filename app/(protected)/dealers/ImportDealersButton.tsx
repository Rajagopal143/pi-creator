'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { importDealersFromCsvAction } from '@/lib/dealers/server-actions';

export function ImportDealersButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');

  return (
    <div className="flex flex-col items-end gap-1">
      {message ? <p className="max-w-xs text-right text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
