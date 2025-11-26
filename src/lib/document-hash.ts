
// ================================================================
// DOCUMENT HASH UTILITY - Implementação SHA256 para Deduplicação
// ================================================================
// Utilitário para calcular hash SHA256 de documentos e implementar
// lógica de deduplicação conforme especificação

import * as crypto from 'crypto';
import { ICONS } from './icons';
import { log, logError } from '@/lib/services/logger';

export interface DocumentHashResult {
  textSha: string;
  size: number;
  calculatedAt: Date;
}

export interface DeduplicationCheck {
  isDuplicate: boolean;
  originalDocumentId?: string;
  originalDocument?: {
    id: string;
    name: string;
    caseId: string;
    caseName?: string;
    uploadedAt: Date;
  };
}

export class DocumentHashManager {
  /**
   * Calcula SHA256 do binário do arquivo
   */
  calculateSHA256(buffer: Buffer): DocumentHashResult {
    log.info({ msg: 'Calculando SHA256 do arquivo ( bytes)...' });

    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    const textSha = hash.digest('hex');

    log.info({ msg: 'SHA256 calculado: ...' });

    return {
      textSha,
      size: buffer.length,
      calculatedAt: new Date()
    };
  }

  /**
   * Verifica se documento já existe no workspace (deduplicação)
   */
  async checkDeduplication(
    textSha: string,
    workspaceId: string,
    prisma: {
      caseDocument: {
        findFirst: (args: {
          where: { textSha: string; case: { workspaceId: string } };
          include: { case: { select: { id: boolean; title: boolean; number: boolean } } };
        }) => Promise<{
          id: string;
          name: string;
          caseId: string;
          createdAt: Date;
          case: { id: string; title: string; number: string };
        } | null>;
      };
    }
  ): Promise<DeduplicationCheck> {
    log.info({ msg: 'Verificando deduplicação para hash: ...' });

    try {
      // Buscar documento existente com mesmo hash no workspace
      const existingDocument = await prisma.caseDocument.findFirst({
        where: {
          textSha,
          case: {
            workspaceId
          }
        },
        include: {
          case: {
            select: {
              id: true,
              title: true,
              number: true
            }
          }
        }
      });

      if (existingDocument) {
        log.info({ msg: 'Documento duplicado encontrado:  (caso: )' });

        return {
          isDuplicate: true,
          originalDocumentId: existingDocument.id,
          originalDocument: {
            id: existingDocument.id,
            name: existingDocument.name,
            caseId: existingDocument.caseId,
            caseName: existingDocument.case.title,
            uploadedAt: existingDocument.createdAt
          }
        };
      }

      log.info({ msg: 'Documento é único no workspace' });
      return { isDuplicate: false };

    } catch (error) {
      logError(error, '${ICONS.ERROR} Erro na verificação de deduplicação:', { component: 'refactored' });
      // Em caso de erro, assumir que não é duplicata para não bloquear upload
      return { isDuplicate: false };
    }
  }

  /**
   * Gera chave para cache de análise
   */
  generateAnalysisKey(textSha: string, modelVersion: string, promptSignature: string): string {
    const combinedString = `${textSha}_${modelVersion}_${promptSignature}`;
    return crypto.createHash('sha256').update(combinedString).digest('hex');
  }

  /**
   * Gera hash do conteúdo normalizado para timeline
   */
  generateContentHash(normalizedContent: string): string {
    return crypto.createHash('sha256').update(normalizedContent.trim().toLowerCase()).digest('hex');
  }

  /**
   * Normaliza texto para comparação na timeline
   */
  normalizeForTimeline(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remover pontuação primeiro
      .replace(/\s+/g, '') // Remover todos os espaços para comparação
      .substring(0, 500); // Limitar tamanho para comparação eficiente
  }
}

// Singleton para reutilização
let documentHashManager: DocumentHashManager | null = null;

export function getDocumentHashManager(): DocumentHashManager {
  if (!documentHashManager) {
    documentHashManager = new DocumentHashManager();
  }
  return documentHashManager;
}