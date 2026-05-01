'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { USER_TYPE_LABELS, type DealerUserType } from '@/lib/dealers/referenceData';
import type { DealerListRow } from '@/lib/dealers/types';

const LIMIT = 20;

interface ApiResponse {
  success: boolean;
  data: DealerListRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export default function DealersListClient() {
  const [dealers, setDealers] = useState<DealerListRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('limit', String(LIMIT));
      if (q.trim()) params.set('search', q.trim());

      const res = await fetch(`/api/dealers?${params.toString()}`);
      const json = (await res.json()) as ApiResponse;
      if (!json.success) throw new Error('Failed to load dealers');
      setDealers(json.data);
      setMeta({
        total: json.meta.total,
        page: json.meta.page,
        totalPages: json.meta.totalPages,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page, appliedSearch);
  }, [page, appliedSearch, load]);

  const handleSearch = () => {
    setAppliedSearch(searchInput.trim());
    setPage(1);
  };

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

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
          <Input
            placeholder="Dealer ID, firm, email, contact…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button type="button" variant="secondary" onClick={handleSearch}>
          Search
        </Button>
        {appliedSearch ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearchInput('');
              setAppliedSearch('');
              setPage(1);
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        {meta.total} dealer{meta.total !== 1 ? 's' : ''} total
        {appliedSearch ? ` · filtered` : ''}
      </p>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {error ? (
          <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
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
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : dealers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No dealers match your criteria. Import CSV or add a dealer.
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

        {meta.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Page {meta.page} of {meta.totalPages} · {meta.total} results
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ← Prev
              </Button>
              {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(meta.totalPages - 4, page - 2)) + i;
                return (
                  <Button
                    key={p}
                    type="button"
                    variant={p === page ? 'default' : 'outline'}
                    size="sm"
                    className="min-w-8 px-0"
                    disabled={loading}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages || loading}
                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              >
                Next →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
