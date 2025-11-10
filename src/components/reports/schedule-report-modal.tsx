'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ICONS } from '@/lib/icons';

// Type Guard for quota information
interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  isNearLimit: boolean;
  sufficient: boolean;
}

function isQuotaInfo(data: unknown): data is QuotaInfo {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.used === 'number' &&
    typeof obj.limit === 'number' &&
    typeof obj.remaining === 'number' &&
    typeof obj.isNearLimit === 'boolean' &&
    typeof obj.sufficient === 'boolean'
  );
}

export interface ScheduleReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  processes?: Array<{
    id: string;
    number: string;
    client: string;
    status: string;
  }>;
  onScheduleComplete?: (result: unknown) => void;
}

interface ScheduleForm {
  name: string;
  description: string;
  type: 'COMPLETO' | 'NOVIDADES';
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  audienceType: 'CLIENTE' | 'DIRETORIA' | 'USO_INTERNO';
  outputFormats: ('PDF' | 'DOCX')[];
  processIds: string[];
  recipients: string[];
  preferredTime: string;
}

export function ScheduleReportModal({
  isOpen,
  onClose,
  workspaceId,
  processes = [],
  onScheduleComplete
}: ScheduleReportModalProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);

  const [form, setForm] = useState<ScheduleForm>({
    name: '',
    description: '',
    type: 'COMPLETO',
    frequency: 'WEEKLY',
    audienceType: 'CLIENTE',
    outputFormats: ['PDF'],
    processIds: [],
    recipients: [''],
    preferredTime: '07:00'
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError(null);
      setForm({
        name: '',
        description: '',
        type: 'COMPLETO',
        frequency: 'WEEKLY',
        audienceType: 'CLIENTE',
        outputFormats: ['PDF'],
        processIds: [],
        recipients: [''],
        preferredTime: '07:00'
      });
    }
  }, [isOpen]);

  // Update quota info when processes change
  useEffect(() => {
    if (form.processIds.length > 0) {
      checkQuota();
    }
  }, [form.processIds.length, form.type]);

  const checkQuota = async () => {
    try {
      // Mock quota check - replace with real API call
      const quota = {
        used: 15,
        limit: 50,
        remaining: 35,
        isNearLimit: false,
        sufficient: true
      };
      setQuotaInfo(quota);
    } catch (error) {
      console.error('Erro ao verificar quota:', error);
    }
  };

  const updateForm = (field: keyof ScheduleForm, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleProcess = (processId: string) => {
    setForm(prev => ({
      ...prev,
      processIds: prev.processIds.includes(processId)
        ? prev.processIds.filter(id => id !== processId)
        : [...prev.processIds, processId]
    }));
  };

  const toggleOutputFormat = (format: 'PDF' | 'DOCX') => {
    if (format === 'PDF') return; // PDF é obrigatório

    setForm(prev => ({
      ...prev,
      outputFormats: prev.outputFormats.includes(format)
        ? prev.outputFormats.filter(f => f !== format)
        : [...prev.outputFormats, format]
    }));
  };

  const addRecipient = () => {
    setForm(prev => ({
      ...prev,
      recipients: [...prev.recipients, '']
    }));
  };

  const updateRecipient = (index: number, email: string) => {
    setForm(prev => ({
      ...prev,
      recipients: prev.recipients.map((r, i) => i === index ? email : r)
    }));
  };

  const removeRecipient = (index: number) => {
    setForm(prev => ({
      ...prev,
      recipients: prev.recipients.filter((_, i) => i !== index)
    }));
  };

  const canProceedToStep2 = () => {
    return form.name.trim() && form.processIds.length > 0;
  };

  const canSubmit = () => {
    return form.recipients.some(r => r.trim() && r.includes('@'));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/reports/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          ...form,
          recipients: form.recipients.filter(r => r.trim())
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar agendamento');
      }

      onScheduleComplete?.(result.schedule);
      onClose();

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Informações básicas */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Nome do relatório *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateForm('name', e.target.value)}
            placeholder="Ex: Relatório Semanal - Cliente ABC"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Descrição (opcional)
          </label>
          <textarea
            value={form.description}
            onChange={(e) => updateForm('description', e.target.value)}
            placeholder="Descrição do relatório..."
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
            rows={3}
          />
        </div>
      </div>

      {/* Tipo de relatório */}
      <div>
        <label className="block text-sm font-medium mb-3">Tipo de relatório</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className={`p-4 cursor-pointer border-2 transition-colors ${
              form.type === 'COMPLETO'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => updateForm('type', 'COMPLETO')}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  form.type === 'COMPLETO'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {form.type === 'COMPLETO' && (
                    <div className="w-full h-full rounded-full bg-white scale-50" />
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-semibold">Relatório Completo</h3>
                <p className="text-sm text-gray-600">
                  Análise detalhada de todos os processos selecionados
                </p>
              </div>
            </div>
          </Card>

          <Card
            className={`p-4 cursor-pointer border-2 transition-colors ${
              form.type === 'NOVIDADES'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => updateForm('type', 'NOVIDADES')}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  form.type === 'NOVIDADES'
                    ? 'border-green-500 bg-green-500'
                    : 'border-gray-300'
                }`}>
                  {form.type === 'NOVIDADES' && (
                    <div className="w-full h-full rounded-full bg-white scale-50" />
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-semibold">Apenas Novidades</h3>
                <p className="text-sm text-gray-600">
                  Apenas movimentações recentes e atualizações
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Seleção de processos */}
      <div>
        <label className="block text-sm font-medium mb-3">
          Processos ({form.processIds.length} selecionados)
        </label>
        <Card className="p-4 max-h-60 overflow-y-auto">
          {processes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div>{ICONS.PROCESS}</div>
              <div className="mt-2">Nenhum processo disponível</div>
            </div>
          ) : (
            <div className="space-y-2">
              {processes.map(process => (
                <div
                  key={process.id}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  onClick={() => toggleProcess(process.id)}
                >
                  <Checkbox
                    checked={form.processIds.includes(process.id)}
                    onCheckedChange={() => toggleProcess(process.id)}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{process.number}</div>
                    <div className="text-xs text-gray-500">
                      {process.client} • {process.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quota info */}
      {isQuotaInfo(quotaInfo) && form.processIds.length > 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Quota mensal</div>
              <div className="text-sm text-gray-600">
                {quotaInfo.used}/{quotaInfo.limit} relatórios utilizados
              </div>
            </div>
            <div className={`font-bold ${
              quotaInfo.sufficient ? 'text-green-600' : 'text-red-600'
            }`}>
              {quotaInfo.sufficient ? `${quotaInfo.remaining} restantes` : 'Quota esgotada'}
            </div>
          </div>
        </Card>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      {/* Frequência */}
      <div>
        <label className="block text-sm font-medium mb-3">Frequência</label>
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: 'WEEKLY', label: 'Semanal' },
            { value: 'BIWEEKLY', label: 'Quinzenal' },
            { value: 'MONTHLY', label: 'Mensal' }
          ].map(option => (
            <button
              key={option.value}
              onClick={() => updateForm('frequency', option.value)}
              className={`p-3 text-center border rounded-lg transition-colors ${
                form.frequency === option.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Público-alvo */}
      <div>
        <label className="block text-sm font-medium mb-3">Público-alvo</label>
        <div className="space-y-2">
          {[
            { value: 'CLIENTE', label: 'Cliente', desc: 'Linguagem acessível para leigos' },
            { value: 'DIRETORIA', label: 'Diretoria', desc: 'Linguagem executiva e estratégica' },
            { value: 'USO_INTERNO', label: 'Uso Interno', desc: 'Linguagem técnica jurídica' }
          ].map(option => (
            <div
              key={option.value}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                form.audienceType === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => updateForm('audienceType', option.value)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  form.audienceType === option.value
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {form.audienceType === option.value && (
                    <div className="w-full h-full rounded-full bg-white scale-50" />
                  )}
                </div>
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-gray-600">{option.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Formatos de saída */}
      <div>
        <label className="block text-sm font-medium mb-3">Formatos de saída</label>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-2">
            <Checkbox checked={true} disabled />
            <div>
              <div className="font-medium">PDF</div>
              <div className="text-sm text-gray-600">Formato obrigatório</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2">
            <Checkbox
              checked={form.outputFormats.includes('DOCX')}
              onCheckedChange={() => toggleOutputFormat('DOCX')}
            />
            <div>
              <div className="font-medium">DOCX (Word)</div>
              <div className="text-sm text-gray-600">Formato editável opcional</div>
            </div>
          </div>
        </div>
      </div>

      {/* Horário preferido */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Horário preferido de entrega
        </label>
        <input
          type="time"
          value={form.preferredTime}
          onChange={(e) => updateForm('preferredTime', e.target.value)}
          className="px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
        />
        <div className="text-sm text-gray-500 mt-1">
          Relatórios são gerados durante a madrugada (23h-4h) e entregues no horário especificado
        </div>
      </div>

      {/* Destinatários */}
      <div>
        <label className="block text-sm font-medium mb-3">Destinatários</label>
        <div className="space-y-2">
          {form.recipients.map((recipient, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="email"
                value={recipient}
                onChange={(e) => updateRecipient(index, e.target.value)}
                placeholder="email@exemplo.com"
                className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
              />
              {form.recipients.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeRecipient(index)}
                >
                  {ICONS.DELETE}
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={addRecipient}
          className="mt-2"
        >
          {ICONS.ADD} Adicionar destinatário
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ICONS.CALENDAR} Agendar Relatório
          </DialogTitle>
          <DialogDescription>
            Configure um relatório automático para ser gerado periodicamente.
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Etapa {step} de 2</span>
            <span className="text-sm text-gray-500">
              {step === 1 ? 'Configuração básica' : 'Detalhes de entrega'}
            </span>
          </div>
          <Progress value={step * 50} className="w-full" />
        </div>

        {/* Error */}
        {error && (
          <Card className="p-4 border-red-200 bg-red-50">
            <div className="flex items-center gap-2 text-red-700">
              <span>{ICONS.ERROR}</span>
              <span className="font-medium">Erro</span>
            </div>
            <div className="text-red-600 text-sm mt-1">{error}</div>
          </Card>
        )}

        {/* Steps */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <div>
            {step === 2 && (
              <Button variant="outline" onClick={() => setStep(1)}>
                {ICONS.ARROW_LEFT} Voltar
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>

            {step === 1 ? (
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedToStep2()}
              >
                Próximo {ICONS.ARROW_RIGHT}
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit() || isSubmitting}
              >
                {isSubmitting ? 'Criando...' : 'Criar Agendamento'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}