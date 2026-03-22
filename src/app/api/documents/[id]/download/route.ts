// ================================================================
// API ROUTE: GET /api/documents/[id]/download
// Download de arquivo de documento
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { ICONS } from '@/lib/icons';
import { readFile } from 'fs/promises';
import { escavadorClient } from '@/lib/escavador-client';

// ================================================================
// MAIN HANDLER
// ================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // ============================================================
    // 1. AUTENTICAÇÃO
    // ============================================================

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }

    const documentId = id;

    console.log(`${ICONS.DOWNLOAD} [Document Download] Iniciando download do documento ${documentId}`);

    // ============================================================
    // 2. BUSCAR DOCUMENTO NO BANCO
    // ============================================================

    const document = await prisma.caseDocument.findUnique({
      where: { id: documentId },
      include: {
        case: {
          include: {
            workspace: {
              include: {
                users: {
                  where: { userId: user.id }
                }
              }
            }
          }
        }
      }
    });

    if (!document) {
      console.warn(`${ICONS.WARNING} [Document Download] Documento não encontrado: ${documentId}`);
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    // ============================================================
    // 3. VALIDAR PERMISSÕES
    // ============================================================

    if (!document.case?.workspace?.users || document.case.workspace.users.length === 0) {
      console.warn(`${ICONS.WARNING} [Document Download] Acesso negado: ${user.id} tentando acessar documento do caso ${document.caseId}`);
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // ============================================================
    // 4. LER ARQUIVO DO DISCO OU ESCAVADOR
    // ============================================================

    let fileBuffer: Buffer | null = null;
    let mimeType = document.mimeType || 'application/octet-stream';
    let fileName = document.originalName || document.name || 'documento';

    const documentUrl = document.url || document.path;

    if (documentUrl?.startsWith('escavador:')) {
      console.log(`${ICONS.DOWNLOAD} [Document Download] Baixando do Escavador: ${documentUrl}`);
      try {
        const parts = documentUrl.split(':');
        const cnj = parts[1];
        const chave = parts[2];
        if (!cnj || !chave) throw new Error('Chave de armazenamento do Escavador inválida');
        
        fileBuffer = await escavadorClient.downloadDocumento(cnj, chave);
        mimeType = 'application/pdf'; // Escavador documents are generally PDFs
        if (!fileName.toLowerCase().endsWith('.pdf')) {
          fileName += '.pdf';
        }
      } catch (error) {
        console.error(`${ICONS.ERROR} [Document Download] Erro ao baixar do Escavador:`, error);
        return NextResponse.json(
          { error: 'Não foi possível baixar o documento do tribunal' },
          { status: 502 }
        );
      }
    } else {
      if (!document.path) {
        console.warn(`${ICONS.WARNING} [Document Download] Caminho do arquivo não definido: ${documentId}`);
        return NextResponse.json(
          { error: 'Arquivo não disponível' },
          { status: 404 }
        );
      }

      try {
        fileBuffer = await readFile(document.path);
      } catch (fileError) {
        console.error(`${ICONS.ERROR} [Document Download] Erro ao ler arquivo:`, fileError);
        return NextResponse.json(
          { error: 'Arquivo não encontrado no servidor' },
          { status: 404 }
        );
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        { error: 'Buffer do arquivo vazio' },
        { status: 500 }
      );
    }

    // ============================================================
    // 5. RETORNAR ARQUIVO
    // ============================================================

    const headers = new Headers();

    // Definir tipo MIME apropriado
    headers.set('Content-Type', mimeType);

    // Definir nome do arquivo para download
    headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);

    // Tamanho do arquivo
    headers.set('Content-Length', fileBuffer.length.toString());

    // Cache control para documentos
    headers.set('Cache-Control', 'private, max-age=3600');

    console.log(`${ICONS.SUCCESS} [Document Download] Documento enviado: ${fileName} (${fileBuffer.length} bytes)`);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} [Document Download] Erro:`, error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro ao fazer download do documento'
      },
      { status: 500 }
    );
  }
}
