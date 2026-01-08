'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { InlineSvgIcon } from '@/components/ui/custom-icon';
import { Settings } from 'lucide-react';

// Navigation item type with custom icon support
interface NavItem {
  href: string;
  label: string;
  iconName?: 'cliente' | 'documentos' | 'ia' | 'calendario' | 'creditos' | 'tempo' | 'upload' | 'atencao';
  isHome?: boolean;
}

export function DashboardHeader() {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', isHome: true },
    { href: '/dashboard/clients', label: 'Clientes', iconName: 'cliente' },
    { href: '/dashboard/process', label: 'Processos', iconName: 'documentos' },
    { href: '/dashboard/documents-upload', label: 'Upload PDFs', iconName: 'upload' },
    { href: '/dashboard/reports', label: 'Relatórios', iconName: 'documentos' },
    { href: '/dashboard/billing', label: 'Créditos', iconName: 'creditos' },
  ];

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-6">
        <SidebarTrigger />

        <div className="flex-1 flex items-center gap-6">
          {/* Logo + Name */}
          <div className="flex items-center gap-2">
            <Image
              src="/optimized/Justo_logo.webp"
              alt="JustoAI"
              width={28}
              height={28}
              className="rounded"
            />
            <h1 className="text-lg font-semibold text-primary-800">
              JustoAI
            </h1>
          </div>

          {/* Navigation */}
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
                    {item.isHome ? (
                      <svg width="16" height="16" viewBox="0 0 64 64" fill="none" className="text-current">
                        <path d="M10 28L32 10L54 28V52C54 54.2 52.2 56 50 56H14C11.8 56 10 54.2 10 52V28Z"
                          stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
                        <path d="M26 56V36H38V56" stroke="currentColor" strokeWidth="2.5" fill="none" />
                      </svg>
                    ) : item.iconName ? (
                      <InlineSvgIcon name={item.iconName} size="sm" />
                    ) : null}
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Settings */}
        <div className="flex items-center gap-2">
          <Link href="/dashboard/settings">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}