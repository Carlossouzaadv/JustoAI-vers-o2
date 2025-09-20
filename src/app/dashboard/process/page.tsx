'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, MoreVertical, Edit, Trash2, Eye, Upload } from 'lucide-react';
import Link from 'next/link';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ICONS } from '@/lib/icons';

interface Case {
  id: string;
  title: string;
  processNumber?: string;
  type: 'CIVIL' | 'CRIMINAL' | 'LABOR' | 'FAMILY' | 'TAX' | 'ADMINISTRATIVE';
  status: 'ACTIVE' | 'CONCLUDED' | 'SUSPENDED' | 'APPEALED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  client: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
  _count: {
    documents: number;
    events: number;
  };
}

export default function ProcessPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Simulação de dados - substituir por API real
  useEffect(() => {
    const mockCases: Case[] = [
      {
        id: '1',
        title: 'Ação de Cobrança - João Silva',
        processNumber: '1234567-89.2024.8.26.0001',
        type: 'CIVIL',
        status: 'ACTIVE',
        priority: 'HIGH',
        client: { id: '1', name: 'João Silva' },
        createdAt: '2025-01-15',
        updatedAt: '2025-01-20',
        _count: { documents: 5, events: 12 }
      },
      {
        id: '2',
        title: 'Divórcio Consensual - Maria Santos',
        processNumber: '9876543-21.2024.8.26.0002',
        type: 'FAMILY',
        status: 'ACTIVE',
        priority: 'MEDIUM',
        client: { id: '2', name: 'Maria Santos' },
        createdAt: '2025-01-10',
        updatedAt: '2025-01-18',
        _count: { documents: 8, events: 6 }
      },
      {
        id: '3',
        title: 'Ação Trabalhista - Empresa ABC',
        processNumber: '5555555-55.2024.5.02.0001',
        type: 'LABOR',
        status: 'CONCLUDED',
        priority: 'LOW',
        client: { id: '3', name: 'Empresa ABC Ltda' },
        createdAt: '2023-12-01',
        updatedAt: '2025-01-15',
        _count: { documents: 15, events: 25 }
      }
    ];

    setTimeout(() => {
      setCases(mockCases);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredCases = cases.filter(caseItem => {
    const matchesSearch = caseItem.title.toLowerCase().includes(search.toLowerCase()) ||
      caseItem.processNumber?.includes(search) ||
      caseItem.client.name.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || caseItem.status === statusFilter;
    const matchesType = typeFilter === 'all' || caseItem.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      ACTIVE: 'bg-green-100 text-green-800 border-green-200',
      CONCLUDED: 'bg-blue-100 text-blue-800 border-blue-200',
      SUSPENDED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      APPEALED: 'bg-purple-100 text-purple-800 border-purple-200'
    };

    const labels = {
      ACTIVE: 'Ativo',
      CONCLUDED: 'Concluído',
      SUSPENDED: 'Suspenso',
      APPEALED: 'Em Recurso'
    };

    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      LOW: 'bg-gray-100 text-gray-800 border-gray-200',
      MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
      URGENT: 'bg-red-100 text-red-800 border-red-200'
    };

    const labels = {
      LOW: 'Baixa',
      MEDIUM: 'Média',
      HIGH: 'Alta',
      URGENT: 'Urgente'
    };

    return (
      <Badge className={variants[priority as keyof typeof variants]}>
        {labels[priority as keyof typeof labels]}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const variants = {
      CIVIL: 'bg-blue-100 text-blue-800 border-blue-200',
      CRIMINAL: 'bg-red-100 text-red-800 border-red-200',
      LABOR: 'bg-green-100 text-green-800 border-green-200',
      FAMILY: 'bg-pink-100 text-pink-800 border-pink-200',
      TAX: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      ADMINISTRATIVE: 'bg-purple-100 text-purple-800 border-purple-200'
    };

    const labels = {
      CIVIL: 'Cível',
      CRIMINAL: 'Criminal',
      LABOR: 'Trabalhista',
      FAMILY: 'Família',
      TAX: 'Tributário',
      ADMINISTRATIVE: 'Administrativo'
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
          <p className="text-neutral-600">Carregando processos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Processos</h1>
          <p className="text-neutral-600">Gerencie seus processos jurídicos e documentos</p>
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard/upload">
            <Button className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Subir Arquivo
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <Input
              placeholder="Buscar por título, número do processo ou cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4" />
            Filtros {showFilters && '(Ativo)'}
          </Button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-neutral-50 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="ACTIVE">Ativo</SelectItem>
                    <SelectItem value="CONCLUDED">Concluído</SelectItem>
                    <SelectItem value="SUSPENDED">Suspenso</SelectItem>
                    <SelectItem value="APPEALED">Em Recurso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Tipo
                </label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="CIVIL">Cível</SelectItem>
                    <SelectItem value="CRIMINAL">Criminal</SelectItem>
                    <SelectItem value="LABOR">Trabalhista</SelectItem>
                    <SelectItem value="FAMILY">Família</SelectItem>
                    <SelectItem value="TAX">Tributário</SelectItem>
                    <SelectItem value="ADMINISTRATIVE">Administrativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusFilter('');
                    setTypeFilter('all');
                  }}
                  className="w-full"
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Total de Processos</p>
              <p className="text-2xl font-bold text-neutral-900">{cases.length}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              {ICONS.PROCESS}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Processos Ativos</p>
              <p className="text-2xl font-bold text-green-600">
                {cases.filter(c => c.status === 'ACTIVE').length}
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
              <p className="text-sm font-medium text-neutral-600">Alta Prioridade</p>
              <p className="text-2xl font-bold text-orange-600">
                {cases.filter(c => c.priority === 'HIGH' || c.priority === 'URGENT').length}
              </p>
            </div>
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              {ICONS.WARNING}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Concluídos</p>
              <p className="text-2xl font-bold text-blue-600">
                {cases.filter(c => c.status === 'CONCLUDED').length}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              {ICONS.CHECK}
            </div>
          </div>
        </Card>
      </div>

      {/* Cases Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Processo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Documentos</TableHead>
              <TableHead>Última Atualização</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCases.map((caseItem) => (
              <TableRow key={caseItem.id}>
                <TableCell>
                  <Link href={`/dashboard/process/${caseItem.id}`} className="block hover:bg-neutral-50 transition-colors rounded p-1 -m-1">
                    <div className="font-medium text-primary-800 hover:text-primary-600 cursor-pointer">{caseItem.title}</div>
                    <div className="text-sm text-neutral-500">{caseItem.processNumber || 'Sem número'}</div>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/dashboard/clients?selected=${caseItem.client.id}`} className="font-medium text-primary-800 hover:text-primary-600 cursor-pointer hover:underline">
                    {caseItem.client.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {getTypeBadge(caseItem.type)}
                </TableCell>
                <TableCell>
                  {getStatusBadge(caseItem.status)}
                </TableCell>
                <TableCell>
                  {getPriorityBadge(caseItem.priority)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {ICONS.DOCUMENT}
                    <span className="text-sm font-medium">{caseItem._count.documents}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-neutral-600">
                  {new Date(caseItem.updatedAt).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/process/${caseItem.id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          Ver detalhes
                        </Link>
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
    </div>
  );
}

