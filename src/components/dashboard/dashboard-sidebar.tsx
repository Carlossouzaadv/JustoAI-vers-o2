'use client';

import { useState, useEffect } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ICONS } from '@/lib/icons';
import { ClientActionsButton } from './client-actions-button';

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  processCount: number;
  status: 'active' | 'inactive';
  lastUpdate: string;
  attentionRequired?: number;
}

interface DashboardSidebarProps {
  selectedClientId?: string;
  onClientSelect?: (clientId: string) => void;
}

export function DashboardSidebar({ selectedClientId, onClientSelect }: DashboardSidebarProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/clients');
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getClientStatusIcon = (client: Client) => {
    if (client.attentionRequired && client.attentionRequired > 0) {
      return <span className="text-red-500">{ICONS.ERROR}</span>;
    }
    if (client.status === 'active') {
      return <span className="text-green-500">{ICONS.SUCCESS}</span>;
    }
    return <span className="text-yellow-500">{ICONS.WARNING}</span>;
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">{ICONS.PROCESS}</span>
          <div>
            <h2 className="font-semibold text-lg">JustoAI</h2>
            <p className="text-xs text-muted-foreground">Dashboard v2</p>
          </div>
        </div>

        <Input
          placeholder="Buscar clientes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </SidebarHeader>

      <SidebarContent>
        <div className="p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            {ICONS.CLIENT} Clientes ({filteredClients.length})
          </h3>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="p-3">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </Card>
              ))}
            </div>
          ) : (
            <SidebarMenu>
              {filteredClients.map((client) => (
                <SidebarMenuItem key={client.id}>
                  <SidebarMenuButton
                    onClick={() => onClientSelect?.(client.id)}
                    isActive={selectedClientId === client.id}
                    className="w-full"
                  >
                    <Card className={`p-3 w-full hover:bg-accent transition-colors cursor-pointer ${
                      selectedClientId === client.id ? 'ring-2 ring-primary' : ''
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {getClientStatusIcon(client)}
                            <h4 className="font-medium text-sm truncate">
                              {client.name}
                            </h4>
                          </div>

                          <div className="mt-1 space-y-1">
                            <p className="text-xs text-muted-foreground">
                              {client.processCount} processo{client.processCount !== 1 ? 's' : ''}
                            </p>

                            {client.attentionRequired && client.attentionRequired > 0 && (
                              <p className="text-xs text-red-600 flex items-center gap-1">
                                {ICONS.WARNING} {client.attentionRequired} atenção
                              </p>
                            )}

                            <p className="text-xs text-muted-foreground">
                              {new Date(client.lastUpdate).toLocaleDateString('pt-BR')}
                            </p>
                          </div>

                          {/* Botão de ações do cliente */}
                          {selectedClientId === client.id && (
                            <div className="mt-2 pt-2 border-t">
                              <ClientActionsButton
                                clientId={client.id}
                                clientName={client.name}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {filteredClients.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Nenhum cliente encontrado</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={loadClients}>
                    Recarregar
                  </Button>
                </div>
              )}
            </SidebarMenu>
          )}
        </div>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Total: {clients.length} clientes</p>
          <p>Ativos: {clients.filter(c => c.status === 'active').length}</p>
          <p>Com atenção: {clients.filter(c => c.attentionRequired && c.attentionRequired > 0).length}</p>
        </div>

        <Button variant="outline" size="sm" className="mt-2 w-full" onClick={loadClients}>
          {ICONS.SEARCH} Atualizar
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}