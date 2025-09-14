'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ICONS } from '@/lib/icons';

export function DashboardHeader() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-6">
        <SidebarTrigger />

        <div className="flex-1">
          <h1 className="text-lg font-semibold">Dashboard Principal</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = '/dashboard/reports'}
          >
            {ICONS.REPORTS} Relatórios
          </Button>

          <Button variant="outline" size="sm">
            {ICONS.SETTINGS} Configurações
          </Button>
        </div>
      </div>
    </header>
  );
}