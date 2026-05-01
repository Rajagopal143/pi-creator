'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageTitleBarProps {
  pageTitle: string;
  /** When true, uses browser history back when possible. */
  browserBack?: boolean;
  fallbackURL: string;
}

export function PageTitleBar({ pageTitle, browserBack = true, fallbackURL }: PageTitleBarProps) {
  const router = useRouter();

  const goBack = () => {
    if (browserBack && typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackURL);
  };

  return (
    <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
        onClick={goBack}
        aria-label="Go back"
      >
        <ArrowLeft className="size-4" />
      </Button>
      <h1 className="text-lg font-semibold tracking-tight text-foreground">{pageTitle}</h1>
    </div>
  );
}
