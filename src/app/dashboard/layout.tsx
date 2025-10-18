'use client';

import { useState, createContext } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import '@/styles/dashboard-animations.css';

// Context para compartilhar estado entre sidebar e página principal
export interface DashboardContextType {
  selectedClientId: string;
  selectedClientName: string;
  setSelectedClient: (id: string, name: string) => void;
}

// Exported context for use in separate hook file (prevents TDZ during minification)
export const DashboardContext = createContext<DashboardContextType | null>(null);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientName, setSelectedClientName] = useState('');

  const setSelectedClient = (id: string, name: string) => {
    setSelectedClientId(id);
    setSelectedClientName(name);
  };

  return (
    <DashboardContext.Provider
      value={{
        selectedClientId,
        selectedClientName,
        setSelectedClient,
      }}
    >
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <DashboardSidebar
            selectedClientId={selectedClientId}
            onClientSelect={(clientId) => {
              // Nome será carregado automaticamente pela página
              setSelectedClient(clientId, '');
            }}
          />
          <div className="flex-1 flex flex-col">
            <DashboardHeader />
            <main className="flex-1 p-6 bg-slate-50">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </DashboardContext.Provider>
  );
}