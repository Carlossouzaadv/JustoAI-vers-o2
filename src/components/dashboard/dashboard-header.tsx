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
      {/* Increased height from h-14 to h-16 */}
      <div className="flex h-16 items-center gap-4 px-6">
        <SidebarTrigger />

        <div className="flex-1 flex items-center gap-8">
          {/* Logo + Name - Larger */}
          <div className="flex items-center gap-3">
            <Image
              src="/optimized/Justo_logo.webp"
              alt="JustoAI"
              width={36}
              height={36}
              className="rounded"
            />
            <h1 className="text-xl font-bold text-primary-800">
              JustoAI
            </h1>
          </div>

          {/* Navigation - Larger buttons with more spacing */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    size="default"
                    className="flex items-center gap-2 text-sm font-medium px-4 py-2"
                  >
                    {item.isHome ? (
                      <svg width="20" height="20" viewBox="0 0 64 64" fill="none" className="text-current">
                        <path d="M10 28L32 10L54 28V52C54 54.2 52.2 56 50 56H14C11.8 56 10 54.2 10 52V28Z"
                          stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
                        <path d="M26 56V36H38V56" stroke="currentColor" strokeWidth="2.5" fill="none" />
                      </svg>
                    ) : item.iconName ? (
                      <InlineSvgIcon name={item.iconName} size="md" />
                    ) : null}
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Settings - Larger */}
        <div className="flex items-center gap-2">
          <Link href="/dashboard/settings">
            <Button variant="outline" size="default" className="flex items-center gap-2 px-4 py-2">
              <Settings className="h-5 w-5" />
              Configurações
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}