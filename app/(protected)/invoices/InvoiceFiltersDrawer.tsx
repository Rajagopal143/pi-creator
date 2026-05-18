'use client';

import { SlidersHorizontal } from 'lucide-react';
import type { ManufacturingUnit } from '@/lib/csvData';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { InvoiceFilterControls, type InvoiceFilters } from './InvoiceFilterControls';

interface InvoiceFiltersDrawerProps {
  manufacturingUnits: ManufacturingUnit[];
  filters: InvoiceFilters;
  onChange: (patch: Partial<InvoiceFilters>) => void;
  onClear: () => void;
  /** Number of filters currently set — shown as a badge on the trigger. */
  activeCount: number;
}

/**
 * Mobile-only "Filters" button that opens a drawer holding every list filter.
 * On desktop the filters render inline next to the search instead.
 */
export function InvoiceFiltersDrawer({
  manufacturingUnits, filters, onChange, onClear, activeCount,
}: InvoiceFiltersDrawerProps) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <SlidersHorizontal className="size-4" />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-700 px-1.5 text-[10px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>Filter Invoices</DrawerTitle>
            <DrawerDescription>
              Narrow the list — changes apply instantly.
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 px-4 pb-2">
            <InvoiceFilterControls
              manufacturingUnits={manufacturingUnits}
              filters={filters}
              onChange={onChange}
              variant="drawer"
            />
          </div>

          <DrawerFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClear}
              disabled={activeCount === 0}
            >
              Clear all
            </Button>
            <DrawerClose asChild>
              <Button type="button" className="flex-1">Done</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
