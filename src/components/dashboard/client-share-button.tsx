'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ICONS } from '@/lib/icons';

interface ClientShareButtonProps {
  clientName: string;
  processCount: number;
}

export function ClientShareButton({ clientName, processCount }: ClientShareButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const generateClientDashboard = async () => {
    setIsGenerating(true);

    // Simular geração de URL
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockUrl = `https://app.justoai.com/client-view/${btoa(clientName.toLowerCase().replace(/\s+/g, '-'))}`;
    setShareUrl(mockUrl);
    setIsGenerating(false);
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {ICONS.UPLOAD} Compartilhar com Cliente
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ICONS.UPLOAD} Dashboard do Cliente - {clientName}
          </DialogTitle>
          <DialogDescription>
            Gere um link personalizado para que seu cliente acompanhe o andamento dos processos dele.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-blue-800">
                Prévia do Dashboard do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cliente:</span>
                <Badge variant="secondary">{clientName}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Processos:</span>
                <Badge className="bg-green-100 text-green-800">{processCount} ativos</Badge>
              </div>
              <div className="text-xs text-blue-600 space-y-1">
                <p>✓ Visualização apenas dos processos do cliente</p>
                <p>✓ Atualizações em tempo real</p>
                <p>✓ Interface simplificada e profissional</p>
                <p>✓ Sem informações confidenciais de outros clientes</p>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            {!shareUrl ? (
              <Button
                onClick={generateClientDashboard}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin mr-2">{ICONS.LOADING}</span>
                    Gerando Dashboard...
                  </>
                ) : (
                  <>
                    {ICONS.GENERATE} Gerar Link do Dashboard
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800 mb-2">
                    Dashboard gerado com sucesso!
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-white rounded text-xs text-gray-700 border">
                      {shareUrl}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(shareUrl)}
                    >
                      {ICONS.ADD} Copiar
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    {ICONS.MAIL} Enviar por E-mail
                  </Button>
                  <Button variant="outline" className="flex-1">
                    {ICONS.CLIENT} Enviar por WhatsApp
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground bg-gray-50 p-3 rounded-lg">
            <p className="font-medium mb-1">Informações Importantes:</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li>O link é válido por 30 dias e pode ser renovado</li>
              <li>O cliente verá apenas os processos dele, sem dados de outros clientes</li>
              <li>As atualizações são em tempo real e automáticas</li>
              <li>Você pode desativar o acesso a qualquer momento</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}