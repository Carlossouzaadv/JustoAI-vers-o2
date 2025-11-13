'use client';

// ================================================================
// HISTÓRICO DE RELATÓRIOS INDIVIDUAIS - Componente Frontend
// ================================================================

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Download,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  CreditCard,
  FileText,
  Trash2,
  Filter,
  RefreshCw,
  TrendingUp,
  Users,
  Target
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Interfaces
interface ReportHistoryItem {
  id: string;
  reportType: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  scheduledFor?: string;
  duration?: number;
  processCount: number;
  fileUrls: Record<string, string>;
  creditInfo: {
    consumed: boolean;
    amount: number;
    message: string;
  };
  downloadUrls: string[];
}

interface HistoryFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  offset: number;
}

interface HistorySummary {
  totalReports: number;
  reportsThisMonth: number;
  totalCreditsUsed: number;
  avgGenerationTime: number;
}

interface IndividualReportsHistoryProps {
  workspaceId: string;
}

export default function IndividualReportsHistory({ workspaceId }: IndividualReportsHistoryProps) {
  // Estados
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [filters, setFilters] = useState<HistoryFilters>({
    limit: 20,
    offset: 0
  });
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    loadReports();
  }, [filters]);

  // Carregar relatórios
  const loadReports = async (append = false) => {
    try {
      setLoading(true);

      const searchParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/reports/individual/history?${searchParams}`, {
        headers: {
          'x-workspace-id': workspaceId
        }
      });

      if (response.ok) {
        const data = await response.json();

        if (append) {
          setReports(prev => [...prev, ...data.reports]);
        } else {
          setReports(data.reports);
        }

        setSummary(data.summary);
        setHasMore(data.pagination.hasMore);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar mais relatórios
  const loadMore = () => {
    setFilters(prev => ({
      ...prev,
      offset: prev.offset + prev.limit
    }));
  };

  // Aplicar filtros
  const applyFilters = (newFilters: Partial<HistoryFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      offset: 0 // Reset offset ao aplicar novos filtros
    }));
  };

  // Cancelar relatório agendado
  const cancelReport = async (reportId: string) => {
    try {
      const response = await fetch(`/api/reports/individual/history?reportId=${reportId}`, {
        method: 'DELETE',
        headers: {
          'x-workspace-id': workspaceId
        }
      });

      if (response.ok) {
        // Recarregar lista
        loadReports();
      }
    } catch (error) {
      console.error('Erro ao cancelar relatório:', error);
    }
  };

  // Baixar arquivo
  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Renderizar status badge
  const renderStatusBadge = (status: string) => {
    const statusConfig = {
      'Agendado': { variant: 'secondary' as const, icon: Clock },
      'Em Processamento': { variant: 'default' as const, icon: RefreshCw },
      'Concluído': { variant: 'default' as const, icon: CheckCircle },
      'Falhou': { variant: 'destructive' as const, icon: XCircle },
      'Cancelado': { variant: 'outline' as const, icon: XCircle }
    } as const;

    type StatusKey = keyof typeof statusConfig;
    const config = (status in statusConfig)
      ? statusConfig[status as StatusKey]
      : { variant: 'secondary' as const, icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Resumo */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total de Relatórios</p>
                  <p className="text-2xl font-bold">{summary.totalReports}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Este Mês</p>
                  <p className="text-2xl font-bold">{summary.reportsThisMonth}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <CreditCard className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Créditos Usados</p>
                  <p className="text-2xl font-bold">{summary.totalCreditsUsed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Target className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tempo Médio</p>
                  <p className="text-2xl font-bold">{Math.round(summary.avgGenerationTime / 1000)}s</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cabeçalho e Filtros */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Histórico de Relatórios Individuais
            </CardTitle>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filtros
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => loadReports()}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Filtros */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <Label>Status</Label>
                <Select
                  value={filters.status || ''}
                  onValueChange={(value) => applyFilters({ status: value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="AGENDADO">Agendado</SelectItem>
                    <SelectItem value="EM_PROCESSAMENTO">Em Processamento</SelectItem>
                    <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                    <SelectItem value="FALHOU">Falhou</SelectItem>
                    <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => applyFilters({ dateFrom: e.target.value || undefined })}
                />
              </div>

              <div>
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => applyFilters({ dateTo: e.target.value || undefined })}
                />
              </div>

              <div>
                <Label>Itens por página</Label>
                <Select
                  value={filters.limit.toString()}
                  onValueChange={(value) => applyFilters({ limit: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* Lista de Relatórios */}
          <div className="space-y-4">
            {reports.map((report) => (
              <Card key={report.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium">{report.reportType}</h3>
                        {renderStatusBadge(report.status)}
                        <Badge variant="outline">
                          {report.processCount} processo{report.processCount !== 1 ? 's' : ''}
                        </Badge>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            Criado em {format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </span>
                        </div>

                        {report.scheduledFor && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>
                              Agendado para {format(new Date(report.scheduledFor), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </span>
                          </div>
                        )}

                        {report.completedAt && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            <span>
                              Concluído em {format(new Date(report.completedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </span>
                          </div>
                        )}

                        {report.duration && (
                          <div className="text-xs text-gray-500">
                            Tempo de processamento: {Math.round(report.duration / 1000)}s
                          </div>
                        )}
                      </div>

                      {/* Informações de Crédito */}
                      <div className={`text-xs p-2 rounded ${
                        report.creditInfo.consumed
                          ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                          : 'bg-green-50 text-green-700 border border-green-200'
                      }`}>
                        <div className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          <span>{report.creditInfo.message}</span>
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2 ml-4">
                      {report.status === 'Agendado' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelReport(report.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}

                      {report.downloadUrls.length > 0 && (
                        <div className="flex gap-1">
                          {report.downloadUrls.map((url, index) => {
                            const format = url.includes('.pdf') ? 'PDF' : 'DOCX';
                            return (
                              <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                onClick={() => downloadFile(url, `relatorio-${report.id}.${format.toLowerCase()}`)}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                {format}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {reports.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Nenhum relatório individual encontrado</p>
                <p className="text-sm">Comece gerando seu primeiro relatório personalizado</p>
              </div>
            )}

            {loading && (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin text-blue-600" />
                <p>Carregando relatórios...</p>
              </div>
            )}

            {/* Carregar Mais */}
            {hasMore && !loading && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={loadMore}
                >
                  Carregar Mais
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}