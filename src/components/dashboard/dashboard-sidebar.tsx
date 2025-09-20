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
      // Using mock data for development - replace with API call when auth is ready
      const mockClients: Client[] = [
        {
          id: '1',
          name: 'João Silva',
          email: 'joao@email.com',
          phone: '(11) 99999-9999',
          processCount: 3,
          status: 'active',
          lastUpdate: '2025-01-15T10:00:00Z',
          attentionRequired: 1
        },
        {
          id: '2',
          name: 'Maria Santos',
          email: 'maria@empresa.com',
          phone: '(11) 88888-8888',
          processCount: 1,
          status: 'active',
          lastUpdate: '2025-01-10T15:30:00Z'
        },
        {
          id: '3',
          name: 'Empresa ABC Ltda',
          email: 'contato@abc.com.br',
          phone: '(11) 77777-7777',
          processCount: 5,
          status: 'active',
          lastUpdate: '2025-01-05T09:15:00Z',
          attentionRequired: 2
        },
        {
          id: '4',
          name: 'Pedro Oliveira',
          email: 'pedro@advocacia.com',
          phone: '(11) 66666-6666',
          processCount: 2,
          status: 'active',
          lastUpdate: '2025-01-12T14:20:00Z'
        }
      ];

      // Simulate API delay but shorter to improve UX
      setTimeout(() => {
        setClients(mockClients);
        setLoading(false);
      }, 100);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
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
            <SidebarMenu className="space-y-2">
              {filteredClients.map((client) => (
                <SidebarMenuItem key={client.id}>
                  <div className="w-full">
                    <SidebarMenuButton
                      onClick={() => {
                        onClientSelect?.(client.id);
                        // Navigate to dashboard with this client selected
                        setTimeout(() => {
                          window.location.href = `/dashboard?client=${client.id}`;
                        }, 200);
                      }}
                      isActive={selectedClientId === client.id}
                      className={`w-full p-3 justify-start ${
                        client.attentionRequired && client.attentionRequired > 0
                          ? 'text-red-600 bg-red-50 hover:bg-red-100'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {getClientStatusIcon(client)}
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-medium text-sm truncate ${
                            client.attentionRequired && client.attentionRequired > 0
                              ? 'text-red-700'
                              : ''
                          }`}>
                            {client.name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {client.processCount} processo{client.processCount !== 1 ? 's' : ''}
                            {client.attentionRequired && client.attentionRequired > 0 && (
                              <span className="text-red-600 ml-1">
                                • {client.attentionRequired} atenção
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </SidebarMenuButton>

                    {/* Dropdown expandido para cliente selecionado */}
                    {selectedClientId === client.id && (
                      <div className="mt-2 ml-4 pl-4 border-l-2 border-primary-200 space-y-2">
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p><strong>Email:</strong> {client.email}</p>
                          <p><strong>Telefone:</strong> {client.phone || 'Não informado'}</p>
                          <p><strong>Última atualização:</strong> {new Date(client.lastUpdate).toLocaleDateString('pt-BR')}</p>
                        </div>

                        <div className="pt-2">
                          <ClientActionsButton
                            clientId={client.id}
                            clientName={client.name}
                          />
                        </div>
                      </div>
                    )}
                  </div>
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