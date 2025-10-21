'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadDialog } from '@/components/onboarding/upload-dialog';
import { Upload, FileText, Zap, CheckCircle2, Clock, BarChart3 } from 'lucide-react';
import { ICONS } from '@/lib/icons';

export default function DocumentsUploadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [recentUploads, setRecentUploads] = useState<any[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);

  // Carregar workspace do usuário
  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const response = await fetch('/api/workspaces', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          if (data.workspaces && data.workspaces.length > 0) {
            setWorkspaceId(data.workspaces[0].id);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar workspace:', error);
      } finally {
        setLoadingWorkspace(false);
      }
    };

    if (status === 'authenticated') {
      loadWorkspace();
    }
  }, [status]);

  if (status === 'loading' || loadingWorkspace) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4">
        {/* Cabeçalho */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Upload de Documentos</h1>
          <p className="text-lg text-gray-600">
            Inicie o fluxo completo de onboarding com PDF inteligente
          </p>
        </div>

        {/* Grid de Fases */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          {/* FASE 1 */}
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-700">FASE 1</span>
              </div>
              <CardTitle className="text-lg">Preview Inteligente</CardTitle>
              <CardDescription>Instantâneo e Gratuito</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-gray-700 space-y-2">
              <p>✓ Extração automática de texto</p>
              <p>✓ Detecção de número do CNJ</p>
              <p>✓ Análise rápida com IA</p>
              <p>✓ Dados básicos extraídos</p>
            </CardContent>
          </Card>

          {/* FASE 2 */}
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">FASE 2</span>
              </div>
              <CardTitle className="text-lg">Enriquecimento Oficial</CardTitle>
              <CardDescription>Automático em Background</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-gray-700 space-y-2">
              <p>✓ Integração com JUDIT</p>
              <p>✓ Dados oficiais do tribunal</p>
              <p>✓ Download de anexos</p>
              <p>✓ Timeline unificada</p>
            </CardContent>
          </Card>

          {/* FASE 3 */}
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">FASE 3</span>
              </div>
              <CardTitle className="text-lg">Análise Estratégica</CardTitle>
              <CardDescription>Sob Demanda (Pago)</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-gray-700 space-y-2">
              <p>✓ IA avançada (Gemini Pro)</p>
              <p>✓ Insights estratégicos</p>
              <p>✓ Análise de riscos</p>
              <p>✓ Recomendações</p>
            </CardContent>
          </Card>
        </div>

        {/* Botão Principal de Upload */}
        <Card className="mb-12 bg-gradient-to-r from-blue-500 to-blue-600 border-0 text-white">
          <CardContent className="pt-12 pb-12">
            <div className="text-center space-y-6">
              <div>
                <Upload className="w-16 h-16 mx-auto opacity-80 mb-4" />
                <h2 className="text-3xl font-bold mb-2">Comece Agora</h2>
                <p className="text-blue-100 text-lg">
                  Faça upload de um PDF para iniciar o processamento completo
                </p>
              </div>

              <Button
                onClick={() => setUploadDialogOpen(true)}
                className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-6 text-lg font-semibold"
              >
                <Upload className="w-5 h-5 mr-2" />
                Fazer Upload de PDF
              </Button>

              <div className="grid grid-cols-3 gap-4 text-sm text-blue-100 max-w-md mx-auto pt-4">
                <div>
                  <p className="font-semibold">Rápido</p>
                  <p>Segundos</p>
                </div>
                <div>
                  <p className="font-semibold">Gratuito</p>
                  <p>FASE 1</p>
                </div>
                <div>
                  <p className="font-semibold">Automático</p>
                  <p>FASE 2</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informações Adicionais */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5" />
                Formatos Aceitos
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <p>✓ PDF (máximo 50MB)</p>
              <p>✓ Documentos de processos judiciais</p>
              <p>✓ Múltiplas páginas suportadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="w-5 h-5" />
                Limitações
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <p>• Um arquivo por upload</p>
              <p>• FASE 3 requer créditos</p>
              <p>• Processamento ~5-10 segundos</p>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Rápido */}
        <Card className="bg-gray-100 border-0">
          <CardHeader>
            <CardTitle>Perguntas Frequentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-semibold text-gray-900 mb-1">
                Quanto tempo leva cada fase?
              </p>
              <p className="text-gray-600">
                FASE 1: 1-3 segundos | FASE 2: 30 segundos a 2 minutos | FASE 3: 10-30 segundos
              </p>
            </div>

            <div>
              <p className="font-semibold text-gray-900 mb-1">
                Preciso fazer algo durante o processamento?
              </p>
              <p className="text-gray-600">
                Não! FASE 2 e FASE 3 são automáticas. Você receberá notificações quando ficarem prontas.
              </p>
            </div>

            <div>
              <p className="font-semibold text-gray-900 mb-1">
                Como funciona o sistema de créditos?
              </p>
              <p className="text-gray-600">
                FASE 1 e FASE 2 são gratuitas. FASE 3 consome 1 crédito de análise estratégica.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Upload */}
      {workspaceId && (
        <UploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          workspaceId={workspaceId}
          onUploadSuccess={(data) => {
            console.log('Upload realizado com sucesso:', data);
            // Opcionalmente redirecionar ou atualizar UI
          }}
        />
      )}
    </div>
  );
}
