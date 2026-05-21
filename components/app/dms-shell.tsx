'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Boxes, Building2, FilePlus2, List, LogOut, Package,
  PackageSearch, Settings, Truck, Wallet,
} from 'lucide-react';

import { InstallPWAButton } from '@/components/app/InstallPWAButton';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';

/**
 * On mobile the sidebar is a sheet — auto-close it as soon as the user picks
 * a destination so they don't have to dismiss the menu manually. Lives inside
 * SidebarProvider so it can call `useSidebar`.
 */
function MobileSidebarAutoClose() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);
  return null;
}

export function DmsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

  return (
    <SidebarProvider>
      <MobileSidebarAutoClose />
      <Sidebar collapsible="icon" className="border-r border-sidebar-border print:hidden">
        <SidebarHeader className="gap-3 p-2">
            <Image src="/logo.svg" alt="" width={100} height={100} className="shrink-0 size-10 w-full" />
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === '/create-pi'}
                    tooltip="Create Proforma Invoice"
                  >
                    <Link href="/create-pi">
                      <FilePlus2 />
                      <span>Create Proforma Invoice</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === '/invoices'}
                    tooltip="All Invoices"
                  >
                    <Link href="/invoices">
                      <List />
                      <span>All Invoices</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === '/payments'}
                    tooltip="Payments"
                  >
                    <Link href="/payments">
                      <Wallet />
                      <span>Payments</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === '/dispatch'}
                    tooltip="Dispatch Queue"
                  >
                    <Link href="/dispatch">
                      <Truck />
                      <span>Dispatch</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === '/transit'}
                    tooltip="In Transit"
                  >
                    <Link href="/transit">
                      <PackageSearch />
                      <span>In Transit</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === '/stock'}
                    tooltip="Stock"
                  >
                    <Link href="/stock">
                      <Boxes />
                      <span>Stock</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === '/dealers' || pathname.startsWith('/dealers/')}
                    tooltip="Dealers"
                  >
                    <Link href="/dealers">
                      <Building2 />
                      <span>Dealers</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === '/products' || pathname.startsWith('/products/')}
                    tooltip="Products"
                  >
                    <Link href="/products">
                      <Package />
                      <span>Products</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === '/settings'}
                    tooltip="Settings"
                  >
                    <Link href="/settings">
                      <Settings />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-2">
          <SidebarMenu>
            <InstallPWAButton />
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} tooltip="Sign out">
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-svh print:min-h-0">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-4 print:hidden">
          <SidebarTrigger />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">
              {(() => {
                if (pathname === '/create-pi') return 'Create Proforma Invoice';
                if (pathname === '/invoices') return 'All Invoices';
                if (pathname === '/payments') return 'Payments';
                if (pathname === '/dispatch') return 'Dispatch Queue';
                if (pathname === '/transit') return 'In Transit';
                if (pathname === '/stock') return 'Stock';
                if (pathname === '/dealers/add') return 'Add New Dealer';
                if (pathname.startsWith('/dealers')) return 'Dealers';
                if (pathname === '/products') return 'Products';
                if (pathname === '/products/new') return 'Add Product';
                if (pathname.startsWith('/products')) return 'Edit Product';
                if (pathname === '/settings') return 'Settings';
                return 'Yakuza DMS';
              })()}
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
