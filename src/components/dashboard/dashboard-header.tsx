'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ICONS } from '@/lib/icons';

export function DashboardHeader() {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: ICONS.HOME },
    { href: '/dashboard/clients', label: 'Clientes', icon: ICONS.CLIENT },
    { href: '/dashboard/process', label: 'Processos', icon: ICONS.PROCESS },
    { href: '/dashboard/documents-upload', label: 'Upload PDFs', icon: ICONS.UPLOAD },
    { href: '/dashboard/reports', label: 'Relatórios', icon: ICONS.REPORTS },
    { href: '/dashboard/billing', label: 'Créditos', icon: ICONS.CREDIT },
  ];

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-6">
        <SidebarTrigger />

        <div className="flex-1 flex items-center gap-6">
          <h1 className="text-lg font-semibold">
            JustoAI
          </h1>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    {item.icon}
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/settings">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              {ICONS.SETTINGS} Configurações
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}