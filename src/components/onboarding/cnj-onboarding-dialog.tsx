'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Loader2, AlertTriangle, CheckCircle2, FileSearch } from 'lucide-react';

interface CnjOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onSuccess?: () => void;
}

interface OnboardingResult {
  success?: boolean;
  case?: { id: string };
  processo?: { numeroCnj?: string };
  stats?: { movimentacoes?: number; documentos?: number };
  error?: string;
  message?: string;
}

export function CnjOnboardingDialog({
  open,
  onOpenChange,
  workspaceId,
  onSuccess
}: CnjOnboardingDialogProps) {
  const router = useRouter();
  
  // Estados
  const [cnj, setCnj] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  // Validação de CNJ (regex)
  const validateCNJ = (value: string): boolean => {
    // Formato: NNNNNNN-DD.AAAA.J.TT.OOOO
    const cnjRegex = /^\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}$/;
    return cnjRegex.test(value);
  };

  // Formatar CNJ enquanto digita
  const handleCnjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove não-dígitos
    
    // Aplicar máscara: NNNNNNN-DD.AAAA.J.TT.OOOO
    if (value.length > 7) {
      value = value.slice(0, 7) + '-' + value.slice(7);
    }
    if (value.length > 10) {
      value = value.slice(0, 10) + '.' + value.slice(10);
    }
    if (value.length > 15) {
      value = value.slice(0, 15) + '.' + value.slice(15);
    }
    if (value.length > 17) {
      value = value.slice(0, 17) + '.' + value.slice(17);
    }
    if (value.length > 20) {
      value = value.slice(0, 20) + '.' + value.slice(20);
    }
    if (value.length > 25) {
      value = value.slice(0, 25); // Limitar tamanho
    }
    
    setCnj(value);
    
    // Validar em tempo real
    if (value.length === 25) {
      if (!validateCNJ(value)) {
        setValidationError('CNJ inválido. Verifique o formato.');
      } else {
        setValidationError(null);
      }
    } else {
      setValidationError(null);
    }
  };

  // Enviar para API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar antes de enviar
    if (!validateCNJ(cnj)) {
      setValidationError('CNJ inválido. Formato esperado: 0000000-00.0000.0.00.0000');
      return;
    }
    
    setLoading(true);
    setError(null);
    setShowProgress(true);
    
    try {
      const response = await fetch('/api/process/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          cnj,
          workspaceId
        })
      });
      
      const data: OnboardingResult = await response.json();
      
      if (!response.ok) {
        // Tratar erro de limite
        if (data.error === 'PROCESS_LIMIT_REACHED') {
          setError(data.message || 'Limite de processos atingido');
          setShowProgress(false);
          return;
        }
        
        throw new Error(data.error || 'Erro ao adicionar processo');
      }
      
      // Sucesso!
      setResult(data);
      
      // Aguardar um pouco para mostrar sucesso
      setTimeout(() => {
        onSuccess?.();
        
        // Redirecionar para o processo criado
        if (data.case?.id) {
          router.push(`/dashboard/process/${data.case.id}?tab=analysis`);
        } else {
          // Fechar e recarregar lista
          onOpenChange(false);
          router.refresh();
        }
      }, 2000);
      
    } catch (err) {
      console.error('[CnjOnboarding] Erro:', err);
      const message = err instanceof Error ? err.message : 'Erro ao adicionar processo';
      setError(message);
      setShowProgress(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
      // Reset ao fechar
      setTimeout(() => {
        setCnj('');
        setError(null);
        setValidationError(null);
        setResult(null);
        setShowProgress(false);
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex gap-2 items-center">
            <FileSearch className="h-5 w-5" />
            Adicionar Processo via CNJ
          </DialogTitle>
          <DialogDescription>
            Digite o número CNJ do processo para buscar e adicionar automaticamente.
          </DialogDescription>
        </DialogHeader>

        {!showProgress ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo CNJ */}
            <div className="space-y-2">
              <Label htmlFor="cnj">Número CNJ</Label>
              <Input
                id="cnj"
                type="text"
                placeholder="0000000-00.0000.0.00.0000"
                value={cnj}
                onChange={handleCnjChange}
                disabled={loading}
                className={validationError ? 'border-red-500' : ''}
                autoFocus
              />
              {validationError && (
                <p className="text-sm text-red-500">{validationError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Exemplo: 0000001-23.2024.4.02.5101
              </p>
            </div>

            {/* Erro geral */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Botões */}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || !cnj || !!validationError}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando processo...
                  </>
                ) : (
                  'Adicionar Processo'
                )}
              </Button>
            </div>
          </form>
        ) : (
          /* Progress Component */
          <div className="space-y-4">
            {result ? (
              <Card className="p-4 bg-green-50 border-green-200">
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-900">Processo adicionado com sucesso!</h4>
                    <p className="text-sm text-green-700 mt-1">
                      CNJ: {result.processo?.numeroCnj || cnj}
                    </p>
                    {result.stats && (
                      <p className="text-xs text-green-600 mt-1">
                        {result.stats.movimentacoes || 0} movimentações • {result.stats.documentos || 0} documentos
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-6 bg-blue-50 border-blue-200">
                <div className="flex gap-3 items-center">
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  <div>
                    <h4 className="font-medium text-blue-900">Buscando processo...</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Conectando aos tribunais e buscando dados oficiais.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
