'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, MoreVertical, Edit, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ICONS } from '@/lib/icons';

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  document?: string;
  type: 'INDIVIDUAL' | 'COMPANY';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt: string;
  _count: {
    cases: number;
  };
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Load clients from API
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/clients?limit=1000', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setClients(data.data || []);
      } else {
        console.error('Failed to load clients:', response.status);
        setClients([]);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(search.toLowerCase()) ||
    client.email.toLowerCase().includes(search.toLowerCase()) ||
    client.document?.includes(search)
  );

  const getStatusBadge = (status: string) => {
    const variants = {
      ACTIVE: 'bg-green-100 text-green-800 border-green-200',
      INACTIVE: 'bg-gray-100 text-gray-800 border-gray-200',
      SUSPENDED: 'bg-red-100 text-red-800 border-red-200'
    };

    const labels = {
      ACTIVE: 'Ativo',
      INACTIVE: 'Inativo',
      SUSPENDED: 'Suspenso'
    };

    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const variants = {
      INDIVIDUAL: 'bg-blue-100 text-blue-800 border-blue-200',
      COMPANY: 'bg-purple-100 text-purple-800 border-purple-200'
    };

    const labels = {
      INDIVIDUAL: 'Pessoa Física',
      COMPANY: 'Pessoa Jurídica'
    };

    return (
      <Badge className={variants[type as keyof typeof variants]}>
        {labels[type as keyof typeof labels]}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Carregando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Clientes</h1>
          <p className="text-neutral-600">Gerencie seus clientes e seus dados</p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Cliente</DialogTitle>
              <DialogDescription>
                Preencha os dados do cliente abaixo
              </DialogDescription>
            </DialogHeader>
            <CreateClientForm onClose={() => setShowCreateDialog(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <Input
              placeholder="Buscar por nome, email ou documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Total de Clientes</p>
              <p className="text-2xl font-bold text-neutral-900">{clients.length}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              {ICONS.CLIENT}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Clientes Ativos</p>
              <p className="text-2xl font-bold text-green-600">
                {clients.filter(c => c.status === 'ACTIVE').length}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              {ICONS.CHECK}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Pessoa Física</p>
              <p className="text-2xl font-bold text-blue-600">
                {clients.filter(c => c.type === 'INDIVIDUAL').length}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              {ICONS.CLIENT}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Pessoa Jurídica</p>
              <p className="text-2xl font-bold text-purple-600">
                {clients.filter(c => c.type === 'COMPANY').length}
              </p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              {ICONS.MONEY}
            </div>
          </div>
        </Card>
      </div>

      {/* Clients Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Casos</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <div>
                    <div
                      className="font-medium text-neutral-900 hover:text-primary-600 cursor-pointer hover:underline transition-colors"
                      onClick={() => window.location.href = `/dashboard?client=${client.id}`}
                      title="Visualizar dashboard do cliente"
                    >
                      {client.name}
                    </div>
                    <div className="text-sm text-neutral-500">{client.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  {getTypeBadge(client.type)}
                </TableCell>
                <TableCell className="text-sm text-neutral-600">
                  {client.phone || '-'}
                </TableCell>
                <TableCell className="text-sm text-neutral-600">
                  {client.document || '-'}
                </TableCell>
                <TableCell>
                  {getStatusBadge(client.status)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {ICONS.PROCESS}
                    <span className="text-sm font-medium">{client._count.cases}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-neutral-600">
                  {new Date(client.createdAt).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedClient(client)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Ver detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Client Details Modal */}
      {selectedClient && (
        <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes do Cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-600">Nome</label>
                <p className="text-neutral-900">{selectedClient.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">Email</label>
                <p className="text-neutral-900">{selectedClient.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">Telefone</label>
                <p className="text-neutral-900">{selectedClient.phone || 'Não informado'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">Documento</label>
                <p className="text-neutral-900">{selectedClient.document || 'Não informado'}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <label className="text-sm font-medium text-neutral-600">Tipo</label>
                  <div className="mt-1">{getTypeBadge(selectedClient.type)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-600">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedClient.status)}</div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">Casos</label>
                <p className="text-neutral-900">{selectedClient._count.cases} caso(s)</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Component for creating new clients
function CreateClientForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    document: '',
    type: 'INDIVIDUAL' as 'INDIVIDUAL' | 'COMPANY',
    status: 'ACTIVE' as const
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement client creation API call
    console.log('Creating client:', formData);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          {formData.type === 'INDIVIDUAL' ? 'Nome Completo *' : 'Razão Social *'}
        </label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={formData.type === 'INDIVIDUAL' ? 'Nome completo' : 'Razão social'}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Email *
        </label>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="email@exemplo.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Telefone
        </label>
        <Input
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="(11) 99999-9999"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          {formData.type === 'INDIVIDUAL' ? 'CPF' : 'CNPJ'}
        </label>
        <Input
          value={formData.document}
          onChange={(e) => setFormData({ ...formData, document: e.target.value })}
          placeholder={formData.type === 'INDIVIDUAL' ? 'CPF' : 'CNPJ'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Tipo *
        </label>
        <select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value as 'INDIVIDUAL' | 'COMPANY' })}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        >
          <option value="INDIVIDUAL">Pessoa Física</option>
          <option value="COMPANY">Pessoa Jurídica</option>
        </select>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" className="flex-1">
          Criar Cliente
        </Button>
      </div>
    </form>
  );
}