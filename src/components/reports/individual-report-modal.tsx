'use client';

// ================================================================
// MODAL DE RELATÓRIOS INDIVIDUAIS - Interface Frontend
// ================================================================

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock, CreditCard, Download, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Interfaces
interface IndividualReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProcesses: Array<{
    id: string;
    number: string;
    client: { name: string };
    status: string;
    lastMovement?: { date: Date; description: string };
  }>;
  onGenerate: (config: ReportGenerationConfig) => Promise<void>;
  creditBalance?: {
    reportCreditsAvailable: number;
    reportCreditsBalance: number;
  };
}

interface ReportGenerationConfig {
  processIds: string[];
  type: 'JURIDICO' | 'EXECUTIVO';
  format: ('PDF' | 'DOCX')[];
  scheduleAt?: Date;
  forceNewAnalysis?: boolean;
}

interface CacheInfo {
  hit: boolean;
  lastUpdate?: string;
  expiresAt?: string;
}

export default function IndividualReportModal({
  isOpen,
  onClose,
  selectedProcesses,
  onGenerate,
  creditBalance
}: IndividualReportModalProps) {
  // Estados
  const [reportType, setReportType] = useState<'JURIDICO' | 'EXECUTIVO'>('EXECUTIVO');
  const [formats, setFormats] = useState<string[]>(['PDF']);
  const [deliveryMode, setDeliveryMode] = useState<'IMMEDIATE' | 'SCHEDULED'>('IMMEDIATE');
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState<string>('23:00');
  const [forceNewAnalysis, setForceNewAnalysis] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [estimatedCost, setEstimatedCost] = useState(0);

  // Calcular custo estimado
  useEffect(() => {
    if (selectedProcesses.length > 0) {
      const processCount = selectedProcesses.length;
      let cost = 0;

      if (processCount <= 5) {
        cost = 0.25;
      } else if (processCount <= 12) {
        cost = 0.5;
      } else if (processCount <= 25) {
        cost = 1.0;
      } else {
        cost = Math.ceil(processCount / 25);
      }

      setEstimatedCost(cost);
    }
  }, [selectedProcesses]);

  // Verificar cache quando modal abre
  useEffect(() => {
    if (isOpen && selectedProcesses.length > 0) {
      checkReportCache();
    }
  }, [isOpen, selectedProcesses, reportType]);

  // Verificar cache disponível
  const checkReportCache = async () => {
    try {
      const processIds = selectedProcesses.map(p => p.id);

      const response = await fetch('/api/reports/individual/cache-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processIds,
          type: reportType,
          format: formats
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCacheInfo(data.cache);
      }
    } catch (error) {
      console.error('Erro ao verificar cache:', error);
      setCacheInfo(null);
    }
  };

  // Lidar com mudança de formato
  const handleFormatChange = (format: string, checked: boolean) => {
    if (checked) {
      setFormats(prev => [...prev, format]);
    } else {
      setFormats(prev => prev.filter(f => f !== format));
    }
  };

  // Validar formulário
  const isFormValid = () => {
    if (selectedProcesses.length === 0) return false;
    if (formats.length === 0) return false;
    if (deliveryMode === 'SCHEDULED' && !scheduleDate) return false;

    return true;
  };

  // Verificar se tem créditos suficientes
  const hasEnoughCredits = () => {
    if (!creditBalance) return true;

    // Se usar cache, não consome créditos
    if (cacheInfo?.hit && !forceNewAnalysis) return true;

    return creditBalance.reportCreditsAvailable >= estimatedCost;
  };

  // Submeter formulário
  const handleSubmit = async () => {
    if (!isFormValid() || loading) return;

    setLoading(true);

    try {
      const config: ReportGenerationConfig = {
        processIds: selectedProcesses.map(p => p.id),
        type: reportType,
        format: formats as ('PDF' | 'DOCX')[],
        forceNewAnalysis
      };

      if (deliveryMode === 'SCHEDULED' && scheduleDate) {
        const [hours, minutes] = scheduleTime.split(':');
        const scheduledDateTime = new Date(scheduleDate);
        scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        config.scheduleAt = scheduledDateTime;
      }

      await onGenerate(config);
      onClose();
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reset ao fechar
  const handleClose = () => {
    setReportType('EXECUTIVO');
    setFormats(['PDF']);
    setDeliveryMode('IMMEDIATE');
    setScheduleDate(undefined);
    setScheduleTime('23:00');
    setForceNewAnalysis(false);
    setCacheInfo(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Relatório Individual</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Processos Selecionados */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              Processos Selecionados ({selectedProcesses.length})
            </Label>

            <div className="max-h-32 overflow-y-auto border rounded-lg p-3 bg-gray-50">
              {selectedProcesses.map((process) => (
                <div key={process.id} className="flex justify-between items-center py-1">
                  <div className="flex-1">
                    <span className="font-medium">{process.number}</span>
                    <span className="text-sm text-gray-600 ml-2">- {process.client.name}</span>
                  </div>
                  <Badge variant={process.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {process.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Informações de Cache */}
          {cacheInfo && (
            <div className={`p-4 rounded-lg border ${cacheInfo.hit ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {cacheInfo.hit ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <Info className="w-5 h-5 text-blue-600" />
                )}
                <span className="font-medium">
                  {cacheInfo.hit ? 'Relatório Atualizado Disponível' : 'Novo Relatório Será Gerado'}
                </span>
              </div>

              <p className="text-sm text-gray-600">
                {cacheInfo.hit ? (
                  <>
                    Este relatório já está atualizado até a última movimentação.
                    {cacheInfo.lastUpdate && (
                      <span> Última atualização: {format(new Date(cacheInfo.lastUpdate), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                    )}
                    <br />
                    <strong>Não será descontado crédito.</strong>
                  </>
                ) : (
                  'Um novo relatório será gerado e consumirá créditos.'
                )}
              </p>

              {cacheInfo.hit && (
                <div className="mt-3">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={forceNewAnalysis}
                      onCheckedChange={setForceNewAnalysis}
                    />
                    <span className="text-sm">Forçar Nova Análise (consumirá crédito)</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Tipo de Relatório */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Tipo de Relatório</Label>

            <RadioGroup value={reportType} onValueChange={(value) => setReportType(value as 'JURIDICO' | 'EXECUTIVO')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="EXECUTIVO" id="executivo" />
                <Label htmlFor="executivo" className="cursor-pointer">
                  <div>
                    <div className="font-medium">Relatório Executivo</div>
                    <div className="text-sm text-gray-600">Linguagem simplificada, ideal para clientes</div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="JURIDICO" id="juridico" />
                <Label htmlFor="juridico" className="cursor-pointer">
                  <div>
                    <div className="font-medium">Relatório Jurídico</div>
                    <div className="text-sm text-gray-600">Linguagem técnica, detalhado para advogados</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Formato de Entrega */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Formato de Entrega</Label>

            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={formats.includes('PDF')}
                  onCheckedChange={(checked) => handleFormatChange('PDF', checked as boolean)}
                />
                <span>PDF (Recomendado)</span>
              </label>

              <label className="flex items-center gap-2">
                <Checkbox
                  checked={formats.includes('DOCX')}
                  onCheckedChange={(checked) => handleFormatChange('DOCX', checked as boolean)}
                />
                <span>Word (DOCX)</span>
              </label>
            </div>
          </div>

          {/* Modo de Entrega */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Modo de Entrega</Label>

            <RadioGroup value={deliveryMode} onValueChange={(value) => setDeliveryMode(value as 'IMMEDIATE' | 'SCHEDULED')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="IMMEDIATE" id="immediate" />
                <Label htmlFor="immediate" className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    <span>Entrega Imediata</span>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="SCHEDULED" id="scheduled" />
                <Label htmlFor="scheduled" className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Agendar (Janela Noturna 23h-04h)</span>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Agendamento */}
          {deliveryMode === 'SCHEDULED' && (
            <div className="space-y-3 p-4 border rounded-lg bg-blue-50">
              <Label className="text-base font-semibold">Agendamento</Label>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduleDate ? format(scheduleDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={scheduleDate}
                        onSelect={setScheduleDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>Horário</Label>
                  <Select value={scheduleTime} onValueChange={setScheduleTime}>
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
                      <SelectItem value="04:00">04:00</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-sm text-blue-700">
                Relatórios agendados são executados na janela noturna (23h-04h) para otimizar custos e recursos.
              </p>
            </div>
          )}

          {/* Informações de Crédito */}
          <div className="space-y-3 p-4 border rounded-lg bg-yellow-50">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-yellow-600" />
              <Label className="text-base font-semibold">Consumo de Créditos</Label>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Processos selecionados:</span>
                <span className="font-medium">{selectedProcesses.length}</span>
              </div>

              <div className="flex justify-between">
                <span>Custo estimado:</span>
                <span className="font-medium">
                  {(cacheInfo?.hit && !forceNewAnalysis) ? '0' : estimatedCost} crédito(s)
                </span>
              </div>

              {creditBalance && (
                <div className="flex justify-between">
                  <span>Créditos disponíveis:</span>
                  <span className="font-medium">{creditBalance.reportCreditsAvailable}</span>
                </div>
              )}
            </div>

            {!hasEnoughCredits() && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Créditos insuficientes para gerar este relatório</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={!isFormValid() || !hasEnoughCredits() || loading}
            className="min-w-[120px]"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Gerando...
              </div>
            ) : (
              deliveryMode === 'IMMEDIATE' ? 'Gerar Agora' : 'Agendar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}