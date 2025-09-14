'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutosave } from '@/hooks/use-autosave';
import { ICONS } from '@/lib/icons';

interface ProcessSummaryData {
  id: string;
  number: string;
  title: string;
  description?: string;
  court: string;
  judge?: string;
  phase: string;
  status: 'active' | 'suspended' | 'finished';
  value?: number;
  contractedValue?: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  clientId: string;
  clientName: string;
  opposingParty?: string;
  lawyer?: string;
  createdAt: string;
  updatedAt: string;
  nextHearing?: string;
  nextDeadline?: string;
  tags?: string[];
  notes?: string;
}

interface ProcessSummaryProps {
  processId: string;
}

export function ProcessSummary({ processId }: ProcessSummaryProps) {
  const [data, setData] = useState<ProcessSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isSaving, lastSaved, hasUnsavedChanges } = useAutosave(data, {
    delay: 2000, // 2 segundos
    onSave: async (processData) => {
      if (!processData) return;

      const response = await fetch(`/api/processes/${processId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: processData.title,
          description: processData.description,
          value: processData.value,
          contractedValue: processData.contractedValue,
          priority: processData.priority,
          opposingParty: processData.opposingParty,
          lawyer: processData.lawyer,
          notes: processData.notes,
          tags: processData.tags,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar alterações');
      }
    },
    onError: (error) => {
      setError(`Erro ao salvar: ${error.message}`);
    },
  });

  useEffect(() => {
    loadProcessData();
  }, [processId]);

  const loadProcessData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/processes/${processId}`);
      if (!response.ok) {
        throw new Error('Processo não encontrado');
      }

      const result = await response.json();
      setData(result.process);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof ProcessSummaryData, value: any) => {
    if (!data) return;
    setData({ ...data, [field]: value });
  };

  const addTag = (tag: string) => {
    if (!data || !tag.trim()) return;
    const newTags = [...(data.tags || []), tag.trim()];
    updateField('tags', newTags);
  };

  const removeTag = (tagIndex: number) => {
    if (!data || !data.tags) return;
    const newTags = data.tags.filter((_, i) => i !== tagIndex);
    updateField('tags', newTags);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'secondary';
      case 'LOW': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'suspended': return 'secondary';
      case 'finished': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-muted-foreground">
            <span className="text-4xl mb-4 block">{ICONS.ERROR}</span>
            <h3 className="text-lg font-medium mb-2">Erro ao carregar processo</h3>
            <p className="text-sm mb-4">{error}</p>
            <Button onClick={loadProcessData} variant="outline">
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {ICONS.PROCESS} Processo {data.number}
              {isSaving && (
                <span className="text-sm text-blue-600">{ICONS.LOADING} Salvando...</span>
              )}
            </CardTitle>
            {lastSaved && (
              <p className="text-sm text-muted-foreground mt-1">
                Última alteração salva: {lastSaved.toLocaleString('pt-BR')}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Badge variant={getStatusColor(data.status)}>
              {data.status === 'active' ? 'Ativo' :
               data.status === 'suspended' ? 'Suspenso' : 'Finalizado'}
            </Badge>
            <Badge variant={getPriorityColor(data.priority)}>
              {data.priority}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna Esquerda */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Título/Assunto *
              </label>
              <Input
                value={data.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Digite o título do processo"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Descrição
              </label>
              <Textarea
                value={data.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Descrição detalhada do processo"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Vara/Comarca
              </label>
              <Input
                value={data.court}
                readOnly
                className="bg-muted"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Juiz
              </label>
              <Input
                value={data.judge || ''}
                onChange={(e) => updateField('judge', e.target.value)}
                placeholder="Nome do juiz"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Fase Processual
              </label>
              <Input
                value={data.phase}
                readOnly
                className="bg-muted"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Parte Contrária
              </label>
              <Input
                value={data.opposingParty || ''}
                onChange={(e) => updateField('opposingParty', e.target.value)}
                placeholder="Nome da parte contrária"
              />
            </div>
          </div>

          {/* Coluna Direita */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Cliente
              </label>
              <Input
                value={data.clientName}
                readOnly
                className="bg-muted"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Advogado Responsável
              </label>
              <Input
                value={data.lawyer || ''}
                onChange={(e) => updateField('lawyer', e.target.value)}
                placeholder="Nome do advogado"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Valor da Causa
                </label>
                <Input
                  type="number"
                  value={data.value || ''}
                  onChange={(e) => updateField('value', Number(e.target.value) || null)}
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Valor Contratado
                </label>
                <Input
                  type="number"
                  value={data.contractedValue || ''}
                  onChange={(e) => updateField('contractedValue', Number(e.target.value) || null)}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Prioridade
              </label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={data.priority}
                onChange={(e) => updateField('priority', e.target.value)}
              >
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>

            {data.nextHearing && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Próxima Audiência
                </label>
                <Input
                  value={new Date(data.nextHearing).toLocaleString('pt-BR')}
                  readOnly
                  className="bg-muted"
                />
              </div>
            )}

            {data.nextDeadline && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Próximo Prazo
                </label>
                <Input
                  value={new Date(data.nextDeadline).toLocaleString('pt-BR')}
                  readOnly
                  className="bg-muted"
                />
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="mt-6">
          <label className="text-sm font-medium mb-2 block">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {data.tags?.map((tag, index) => (
              <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeTag(index)}>
                {tag} ×
              </Badge>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const tag = prompt('Nova tag:');
                if (tag) addTag(tag);
              }}
            >
              + Adicionar
            </Button>
          </div>
        </div>

        {/* Notas */}
        <div className="mt-6">
          <label className="text-sm font-medium mb-2 block">
            Notas Internas
          </label>
          <Textarea
            value={data.notes || ''}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Anotações internas sobre o processo..."
            rows={4}
          />
        </div>

        {/* Status de salvamento */}
        {hasUnsavedChanges && !isSaving && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              {ICONS.WARNING} Há alterações não salvas. Salvamento automático em alguns segundos...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}