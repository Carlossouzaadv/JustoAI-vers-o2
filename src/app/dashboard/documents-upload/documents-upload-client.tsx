'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { UploadDialog } from '@/components/onboarding/upload-dialog';
import { CnjOnboardingDialog } from '@/components/onboarding/cnj-onboarding-dialog';

export default function DocumentsUploadPageClient() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [cnjDialogOpen, setCnjDialogOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const response = await fetch('/api/workspaces', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.data && result.data.length > 0) {
          setWorkspaceId(result.data[0].id);
        }
      } catch (error) {
        console.error('Erro ao carregar workspace:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadWorkspace();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Adicionar Processos</h1>
        <p className="text-muted-foreground mt-2">
          Escolha como deseja adicionar processos ao sistema
        </p>
      </div>

      {/* Opções de Onboarding */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Opção 1: Upload de PDF */}
        <Card 
          className="hover:shadow-lg transition-shadow cursor-pointer" 
          onClick={() => setUploadDialogOpen(true)}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Upload de PDF</CardTitle>
                <CardDescription>
                  Envie documentos do processo
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Faça upload de petições, sentenças ou qualquer documento em PDF. 
              O sistema extrai o CNJ automaticamente.
            </p>
            <Button className="w-full" variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Fazer Upload
            </Button>
          </CardContent>
        </Card>

        {/* Opção 2: Cadastro via CNJ */}
        <Card 
          className="hover:shadow-lg transition-shadow cursor-pointer" 
          onClick={() => setCnjDialogOpen(true)}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Buscar por CNJ</CardTitle>
                <CardDescription>
                  Digite o número do processo
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Informe o número CNJ e buscamos automaticamente todos os dados 
              do processo nos tribunais.
            </p>
            <Button className="w-full" variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Adicionar via CNJ
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      {workspaceId && (
        <>
          <UploadDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            workspaceId={workspaceId}
            onUploadSuccess={() => {
              setUploadDialogOpen(false);
            }}
          />

          <CnjOnboardingDialog
            open={cnjDialogOpen}
            onOpenChange={setCnjDialogOpen}
            workspaceId={workspaceId}
            onSuccess={() => {
              setCnjDialogOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}
