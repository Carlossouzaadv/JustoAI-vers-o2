'use client';

// ================================================================
// MODAL DE AGENDAMENTO DE RELATÓRIOS - Com Quota e Tom/Público
// ================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  Clock,
  FileText,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Users,
  Building,
  User,
  Moon,
  Zap,
  Info
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useQuotaModal } from '@/components/quota/quota-modal';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface ReportSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProcesses: string[];
  workspaceId: string;
  onScheduleSuccess?: (_reportId: string) => void;
}

interface QuotaStatus {
  current: number;
  limit: number;
  percentage: number;
  status: 'ok' | 'soft_warning' | 'hard_blocked';
  message: string;
}

interface ReportOptions {
  type: 'complete' | 'updates';
  tone: 'client' | 'board' | 'internal';
  formats: string[];
  scheduledFor?: Date;
  useCache: boolean;
  priority: 'normal' | 'night';
}

// ================================================================
// TYPE GUARDS (Padrão-Ouro pattern)
// ================================================================

/**
 * Type guard: validate tone value is one of the valid literals
 * Narrows unknown to specific tone type safely
 */
function isValidTone(value: unknown): value is 'client' | 'board' | 'internal' {
  return typeof value === 'string' && ['client', 'board', 'internal'].includes(value);
}

/**
 * Type guard: validate report type value is one of the valid literals
 * Narrows unknown to specific report type safely
 */
function isValidReportType(value: unknown): value is 'complete' | 'updates' {
  return typeof value === 'string' && ['complete', 'updates'].includes(value);
}

/**
 * Type guard: validate priority value is one of the valid literals
 */
function isValidPriority(value: unknown): value is 'normal' | 'night' {
  return typeof value === 'string' && ['normal', 'night'].includes(value);
}

/**
 * Safe state updaters: preserve narrowed types for ReportOptions (Padrão-Ouro)
 * These functions ensure TypeScript knows the exact return type
 */
function updateReportTone(tone: 'client' | 'board' | 'internal') {
  return (prev: ReportOptions): ReportOptions => ({ ...prev, tone });
}

function updateReportType(type: 'complete' | 'updates') {
  return (prev: ReportOptions): ReportOptions => ({ ...prev, type });
}

function updateReportPriority(priority: 'normal' | 'night') {
  return (prev: ReportOptions): ReportOptions => ({ ...prev, priority });
}

// ================================================================
// CONFIGURAÇÕES
// ================================================================

const TONE_OPTIONS = [
  {
    value: 'client',
    label: 'Cliente',
    description: 'Linguagem acessível para apresentar ao cliente',
    icon: User,
    example: 'Resumo executivo com foco em resultados práticos'
  },
  {
    value: 'board',
    label: 'Diretoria',
    description: 'Formato estratégico para tomada de decisão',
    icon: Building,
    example: 'Análise estratégica com métricas e recomendações'
  },
  {
    value: 'internal',
    label: 'Uso Interno',
    description: 'Linguagem técnica jurídica detalhada',
    icon: Users,
    example: 'Relatório técnico com detalhes processuais completos'
  }
];

const REPORT_TYPES = [
  {
    value: 'complete',
    label: 'Relatório Detalhado (Jurídico)',
    description: 'Análise completa com todos os andamentos e detalhes',
    credits: 1,
    duration: '3-5 min'
  },
  {
    value: 'updates',
    label: 'Resumo Estratégico (Executivo)',
    description: 'Foco nas novidades e pontos principais',
    credits: 0.5,
    duration: '1-2 min'
  }
];

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

export default function ReportSchedulerModal({
  isOpen,
  onClose,
  selectedProcesses,
  workspaceId,
  onScheduleSuccess
}: ReportSchedulerModalProps) {
  // Estados
  const [reportOptions, setReportOptions] = useState<ReportOptions>({
    type: 'complete',
    tone: 'client',
    formats: ['pdf'],
    useCache: true,
    priority: 'normal'
  });

  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'config' | 'schedule' | 'confirm'>('config');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('23:30');

  // Hooks
  const { showQuotaModal, QuotaModalComponent } = useQuotaModal();

  // Carregar status de quota
  const loadQuotaStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/reports/quota-status?workspaceId=${workspaceId}`);
      const data = await response.json();

      if (data.success) {
        setQuotaStatus(data.quotaStatus);
      }
    } catch (error) {
      console.error('Erro ao carregar quota:', error);
    }
  }, [workspaceId]);

  // Carregar saldo de créditos
  const loadCreditBalance = useCallback(async () => {
    try {
      const response = await fetch(`/api/billing/credits?workspaceId=${workspaceId}&action=balance`);
      const data = await response.json();

      if (data.success) {
        setCreditBalance(data.data.balance);
      }
    } catch (error) {
      console.error('Erro ao carregar créditos:', error);
    }
  }, [workspaceId]);

  // Carregar dados iniciais
  useEffect(() => {
    if (isOpen) {
      loadQuotaStatus();
      loadCreditBalance();
    }
  }, [isOpen, workspaceId, loadQuotaStatus, loadCreditBalance]);

  // Calcular estimativas
  const selectedReportType = REPORT_TYPES.find(t => t.value === reportOptions.type)!;
  const estimatedCredits = selectedReportType.credits * selectedProcesses.length;
  const isNightSchedule = reportOptions.priority === 'night';
  const finalCredits = isNightSchedule ? estimatedCredits * 0.5 : estimatedCredits; // 50% desconto noturno

  // Verificar se pode agendar
  const canSchedule = () => {
    if (!quotaStatus) return false;

    // Verificar quota de relatórios
    if (quotaStatus.status === 'hard_blocked') {
      return false;
    }

    // Verificar créditos se necessário
    if (finalCredits > 0 && creditBalance < finalCredits) {
      return false;
    }

    return true;
  };

  // Submeter agendamento
  const handleSchedule = async () => {
    if (!canSchedule()) {
      // Mostrar modal de quota/créditos
      showQuotaModal({
        quotaStatus: quotaStatus?.status || 'hard_blocked',
        current: quotaStatus?.current || 0,
        limit: quotaStatus?.limit || 0,
        percentage: quotaStatus?.percentage || 100,
        message: quotaStatus?.message || 'Limite atingido',
        actions: [
          {
            type: 'buy_credits',
            label: 'Comprar Créditos',
            url: '/billing/credits',
            description: 'Adquira mais créditos para continuar'
          },
          {
            type: 'schedule_night',
            label: 'Agendar para Horário Noturno',
            description: 'Custo reduzido de 23h às 04h'
          }
        ]
      });
      return;
    }

    try {
      setLoading(true);

      const scheduleData = {
        workspaceId,
        processIds: selectedProcesses,
        reportType: reportOptions.type,
        tone: reportOptions.tone,
        formats: reportOptions.formats,
        scheduledFor: reportOptions.priority === 'night' ?
          new Date(`${scheduledDate}T${scheduledTime}:00`) :
          new Date(),
        useCache: reportOptions.useCache,
        priority: reportOptions.priority
      };

      const response = await fetch('/api/reports/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleData)
      });

      const data = await response.json();

      if (data.success) {
        onScheduleSuccess?.(data.reportId);
        onClose();
      } else {
        console.error('Erro no agendamento:', data.error);
      }

    } catch (error) {
      console.error('Erro ao agendar:', error);
    } finally {
      setLoading(false);
    }
  };

  // Renderizar status de quota
  const renderQuotaStatus = () => {
    if (!quotaStatus) return null;

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'ok': return 'text-green-600 bg-green-50 border-green-200';
        case 'soft_warning': return 'text-orange-600 bg-orange-50 border-orange-200';
        case 'hard_blocked': return 'text-red-600 bg-red-50 border-red-200';
        default: return 'text-gray-600 bg-gray-50 border-gray-200';
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'ok': return CheckCircle;
        case 'soft_warning': return AlertTriangle;
        case 'hard_blocked': return AlertTriangle;
        default: return Info;
      }
    };

    const StatusIcon = getStatusIcon(quotaStatus.status);

    return (
      <Alert className={`${getStatusColor(quotaStatus.status)} border`}>
        <StatusIcon className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Quota de Relatórios</span>
              <span className="text-sm">{quotaStatus.current} de {quotaStatus.limit} usados</span>
            </div>
            <Progress value={quotaStatus.percentage} className="h-2" />
            <p className="text-sm">{quotaStatus.message}</p>
          </div>
        </AlertDescription>
      </Alert>
    );
  };

  // Renderizar seleção de tom
  const renderToneSelection = () => (
    <div className="space-y-3">
      <Label className="text-base font-medium">Tom e Público-alvo</Label>
      <div className="grid gap-3">
        {TONE_OPTIONS.map((tone) => {
          const Icon = tone.icon;
          const isSelected = reportOptions.tone === tone.value;

          return (
            <div
              key={tone.value}
              className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => {
                // ✅ Padrão-Ouro: Type guard + safe state updater (no casting)
                if (isValidTone(tone.value)) {
                  setReportOptions(updateReportTone(tone.value));
                }
              }}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{tone.label}</h4>
                    {isSelected && <CheckCircle className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{tone.description}</p>
                  <p className="text-xs text-gray-500 mt-1 italic">{tone.example}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Renderizar seleção de tipo
  const renderTypeSelection = () => (
    <div className="space-y-3">
      <Label className="text-base font-medium">Tipo de Relatório</Label>
      <div className="grid gap-3">
        {REPORT_TYPES.map((type) => {
          const isSelected = reportOptions.type === type.value;

          return (
            <div
              key={type.value}
              className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => {
                // ✅ Padrão-Ouro: Type guard + safe state updater (no casting)
                if (isValidReportType(type.value)) {
                  setReportOptions(updateReportType(type.value));
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{type.label}</h4>
                    {isSelected && <CheckCircle className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                  <p className="text-xs text-gray-500 mt-1">Tempo estimado: {type.duration}</p>
                </div>
                <div className="text-right">
                  <Badge variant={type.credits > 0.5 ? 'default' : 'secondary'}>
                    {type.credits} crédito{type.credits !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Renderizar resumo
  const renderSummary = () => (
    <div className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Resumo do Agendamento
        </h4>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Processos:</span>
            <span className="ml-2 font-medium">{selectedProcesses.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Tipo:</span>
            <span className="ml-2 font-medium">{selectedReportType.label}</span>
          </div>
          <div>
            <span className="text-gray-600">Público:</span>
            <span className="ml-2 font-medium">
              {TONE_OPTIONS.find(t => t.value === reportOptions.tone)?.label}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Formatos:</span>
            <span className="ml-2 font-medium">{reportOptions.formats.join(', ').toUpperCase()}</span>
          </div>
        </div>

        <Separator />

        <div className="flex justify-between items-center">
          <span className="text-gray-600">Créditos necessários:</span>
          <div className="text-right">
            {isNightSchedule && estimatedCredits > finalCredits && (
              <div className="text-xs text-green-600 line-through">
                {estimatedCredits} créditos
              </div>
            )}
            <div className="font-medium flex items-center gap-1">
              <CreditCard className="w-4 h-4" />
              {finalCredits} crédito{finalCredits !== 1 ? 's' : ''}
              {isNightSchedule && (
                <Badge variant="secondary" className="ml-1">50% OFF</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600">Seu saldo atual:</span>
          <span className={`font-medium ${creditBalance >= finalCredits ? 'text-green-600' : 'text-red-600'}`}>
            {creditBalance} crédito{creditBalance !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {reportOptions.priority === 'night' && (
        <Alert className="border-purple-200 bg-purple-50">
          <Moon className="h-4 w-4 text-purple-600" />
          <AlertDescription className="text-purple-700">
            <strong>Agendamento Noturno:</strong> Seu relatório será gerado entre 23h e 04h com 50% de desconto nos créditos.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  // Renderizar conteúdo baseado no step
  const renderContent = () => {
    switch (step) {
      case 'config':
        return (
          <div className="space-y-6">
            {renderQuotaStatus()}
            {renderTypeSelection()}
            {renderToneSelection()}

            <div className="space-y-3">
              <Label className="text-base font-medium">Formatos de Arquivo</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={reportOptions.formats.includes('pdf')}
                    onCheckedChange={(checked) => {
                      setReportOptions(prev => ({
                        ...prev,
                        formats: checked
                          ? [...prev.formats, 'pdf']
                          : prev.formats.filter(f => f !== 'pdf')
                      }));
                    }}
                  />
                  <span>PDF</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={reportOptions.formats.includes('docx')}
                    onCheckedChange={(checked) => {
                      setReportOptions(prev => ({
                        ...prev,
                        formats: checked
                          ? [...prev.formats, 'docx']
                          : prev.formats.filter(f => f !== 'docx')
                      }));
                    }}
                  />
                  <span>Word (DOCX)</span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">Prioridade</Label>
              <Select
                value={reportOptions.priority}
                onValueChange={(value) => {
                  // ✅ Padrão-Ouro: Type guard + safe state updater (no casting)
                  if (isValidPriority(value)) {
                    setReportOptions(updateReportPriority(value));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      <div>
                        <div>Geração Imediata</div>
                        <div className="text-xs text-gray-500">Disponível em 3-5 minutos</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="night">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4" />
                      <div>
                        <div>Agendamento Noturno</div>
                        <div className="text-xs text-gray-500">50% desconto • 23h às 04h</div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'schedule':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Calendar className="w-12 h-12 mx-auto text-blue-600 mb-4" />
              <h3 className="text-lg font-medium mb-2">Quando você quer gerar?</h3>
              <p className="text-gray-600">Escolha data e horário para o agendamento noturno</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  max={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
                />
              </div>
              <div>
                <Label>Horário</Label>
                <Select value={scheduledTime} onValueChange={setScheduledTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="23:00">23:00</SelectItem>
                    <SelectItem value="23:30">23:30</SelectItem>
                    <SelectItem value="00:00">00:00</SelectItem>
                    <SelectItem value="00:30">00:30</SelectItem>
                    <SelectItem value="01:00">01:00</SelectItem>
                    <SelectItem value="01:30">01:30</SelectItem>
                    <SelectItem value="02:00">02:00</SelectItem>
                    <SelectItem value="02:30">02:30</SelectItem>
                    <SelectItem value="03:00">03:00</SelectItem>
                    <SelectItem value="03:30">03:30</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Alert className="border-blue-200 bg-blue-50">
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                <strong>Horário Noturno:</strong> Relatórios são gerados entre 23h e 04h com prioridade reduzida e 50% de desconto nos créditos.
              </AlertDescription>
            </Alert>
          </div>
        );

      case 'confirm':
        return renderSummary();

      default:
        return null;
    }
  };

  // Renderizar botões do footer
  const renderFooterButtons = () => {
    const nextLabel = step === 'config' ?
      (reportOptions.priority === 'night' ? 'Agendar' : 'Gerar Agora') :
      step === 'schedule' ? 'Confirmar' : 'Gerar Relatório';

    return (
      <div className="flex gap-3">
        {step !== 'config' && (
          <Button
            variant="outline"
            onClick={() => {
              if (step === 'schedule') setStep('config');
              if (step === 'confirm') setStep(reportOptions.priority === 'night' ? 'schedule' : 'config');
            }}
          >
            Voltar
          </Button>
        )}

        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1"
        >
          Cancelar
        </Button>

        <Button
          onClick={() => {
            if (step === 'config') {
              if (reportOptions.priority === 'night') {
                setStep('schedule');
              } else {
                setStep('confirm');
              }
            } else if (step === 'schedule') {
              setStep('confirm');
            } else {
              handleSchedule();
            }
          }}
          disabled={
            loading ||
            !canSchedule() ||
            (step === 'schedule' && !scheduledDate)
          }
          className="flex-1"
        >
          {loading ? 'Processando...' : nextLabel}
        </Button>
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Gerar Relatório
              <Badge variant="outline">{selectedProcesses.length} processo{selectedProcesses.length !== 1 ? 's' : ''}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {renderContent()}
          </div>

          <DialogFooter>
            {renderFooterButtons()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuotaModalComponent onActionSelect={(action) => {
        if (action.type === 'schedule_night') {
          setReportOptions(prev => ({ ...prev, priority: 'night' }));
          setStep('schedule');
        }
      }} />
    </>
  );
}