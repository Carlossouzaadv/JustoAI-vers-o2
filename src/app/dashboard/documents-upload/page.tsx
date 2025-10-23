// Desabilitar prerendering estático
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, Zap, Upload, FileText, BarChart3 } from 'lucide-react';
import DocumentsUploadPageClient from './documents-upload-client';

export default async function DocumentsUploadPage() {
  // Verificar autenticação no servidor usando Supabase (garante que a página não pode ser pré-renderizada)
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.delete(name);
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
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

        {/* Componente Client (com estados e interatividade) */}
        <DocumentsUploadPageClient />

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
    </div>
  );
}
