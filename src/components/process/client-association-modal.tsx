'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '@/lib/icons';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
  email?: string;
  type?: string;
}

interface ClientAssociationModalProps {
  caseId: string;
  currentClient?: Client;
  onClientAssociated: (client: Client) => void;
  trigger: React.ReactNode;
}

export function ClientAssociationModal({
  caseId,
  currentClient,
  onClientAssociated,
  trigger,
}: ClientAssociationModalProps) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadClients();
    }
  }, [open]);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch clients from API
      const response = await fetch('/api/clients', {
        credentials: 'include',
      });

      if (!response.ok) {
        setError('Erro ao carregar clientes');
        return;
      }

      const data = await response.json();
      setClients(data.data || []);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
      setError('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClient = async (client: Client) => {
    try {
      // Update case with client ID
      const response = await fetch(`/api/cases/${caseId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: client.id,
        }),
      });

      if (!response.ok) {
        setError('Erro ao associar cliente');
        return;
      }

      onClientAssociated(client);
      setOpen(false);
    } catch (err) {
      console.error('Erro ao associar cliente:', err);
      setError('Erro ao associar cliente');
    }
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searching.toLowerCase()) ||
    client.email?.toLowerCase().includes(searching.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Associar Cliente</DialogTitle>
          <DialogDescription>
            Selecione um cliente existente ou crie um novo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search input */}
          <Input
            placeholder="Buscar cliente por nome ou email..."
            value={searching}
            onChange={(e) => setSearching(e.target.value)}
          />

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Clients list */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {loading ? (
              <div className="text-center py-4 text-neutral-500">
                Carregando clientes...
              </div>
            ) : filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleSelectClient(client)}
                  className="w-full text-left p-3 border rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{client.name}</p>
                      {client.email && (
                        <p className="text-sm text-neutral-500">{client.email}</p>
                      )}
                    </div>
                    {currentClient?.id === client.id && (
                      <Badge variant="outline">Atual</Badge>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-4 text-neutral-500">
                Nenhum cliente encontrado
              </div>
            )}
          </div>

          {/* Create new client button */}
          <div className="border-t pt-4">
            <Link href="/dashboard/clients/new">
              <Button variant="outline" className="w-full">
                {ICONS.PLUS} Cadastrar Novo Cliente
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
