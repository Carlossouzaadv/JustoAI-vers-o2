'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadDialog } from '@/components/onboarding/upload-dialog';
import { Upload } from 'lucide-react';

export default function DocumentsUploadPageClient() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
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

    loadWorkspace();
  }, []);

  return (
    <>
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
              disabled={loadingWorkspace || !workspaceId}
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-6 text-lg font-semibold disabled:opacity-50"
            >
              <Upload className="w-5 h-5 mr-2" />
              {loadingWorkspace ? 'Carregando...' : 'Fazer Upload de PDF'}
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

      {/* Dialog de Upload */}
      {workspaceId !== null && (
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
    </>
  );
}
