/**
 * Timeline Source Utilities
 *
 * Funções auxiliares para exibição visual de fontes de timeline na UI.
 * Ícones, labels, badges e estilos por TimelineSource.
 */

import { TimelineSource } from '@/lib/types/database';
import React from 'react';
import { log, logError } from '@/lib/services/logger';
import {
  FileText,
  Scale,
  PenTool,
  Download,
  Brain,
} from 'lucide-react';

/**
 * Mapa de ícones Lucide para cada fonte
 */
const SOURCE_ICONS: Record<TimelineSource, React.ReactNode> = {
  API_JUDIT: React.createElement(Scale, { className: 'w-3 h-3' }),
  DOCUMENT_UPLOAD: React.createElement(FileText, { className: 'w-3 h-3' }),
  AI_EXTRACTION: React.createElement(Brain, { className: 'w-3 h-3' }),
  MANUAL_ENTRY: React.createElement(PenTool, { className: 'w-3 h-3' }),
  SYSTEM_IMPORT: React.createElement(Download, { className: 'w-3 h-3' }),
};

/**
 * Labels em português para cada fonte
 */
const SOURCE_LABELS: Record<TimelineSource, string> = {
  API_JUDIT: 'JUDIT Oficial',
  DOCUMENT_UPLOAD: 'Documento PDF',
  AI_EXTRACTION: 'Análise IA',
  MANUAL_ENTRY: 'Entrada Manual',
  SYSTEM_IMPORT: 'Importação',
};

/**
 * Descrições detalhadas para tooltips
 */
const SOURCE_DESCRIPTIONS: Record<TimelineSource, string> = {
  API_JUDIT:
    'Andamento obtido da API oficial do Poder Judiciário (maior confiabilidade)',
  DOCUMENT_UPLOAD:
    'Andamento extraído do documento PDF enviado pelo usuário',
  AI_EXTRACTION:
    'Andamento extraído por análise de IA (Gemini) do documento',
  MANUAL_ENTRY: 'Andamento inserido manualmente pelo usuário',
  SYSTEM_IMPORT: 'Andamento importado de integração com sistema externo',
};

/**
 * Variantes de badge por prioridade da fonte
 */
const SOURCE_BADGE_VARIANTS: Record<TimelineSource, string> = {
  API_JUDIT: 'primary',      // Destaque máximo - é a espinha dorsal
  DOCUMENT_UPLOAD: 'secondary',
  AI_EXTRACTION: 'secondary',
  MANUAL_ENTRY: 'outline',
  SYSTEM_IMPORT: 'outline',
};

/**
 * Cores Tailwind para visual de prioridade
 */
const SOURCE_PRIORITY_COLORS: Record<TimelineSource, string> = {
  API_JUDIT:
    'text-blue-700 bg-blue-50 border border-blue-200 dark:text-blue-400 dark:bg-blue-950',
  DOCUMENT_UPLOAD:
    'text-green-700 bg-green-50 border border-green-200 dark:text-green-400 dark:bg-green-950',
  AI_EXTRACTION:
    'text-purple-700 bg-purple-50 border border-purple-200 dark:text-purple-400 dark:bg-purple-950',
  MANUAL_ENTRY:
    'text-gray-700 bg-gray-50 border border-gray-200 dark:text-gray-400 dark:bg-gray-950',
  SYSTEM_IMPORT:
    'text-orange-700 bg-orange-50 border border-orange-200 dark:text-orange-400 dark:bg-orange-950',
};

/**
 * Prioridade numérica de cada fonte (usada em mesclagem)
 */
const SOURCE_PRIORITY: Record<TimelineSource, number> = {
  API_JUDIT: 10,       // Máxima prioridade - dados oficiais
  DOCUMENT_UPLOAD: 8,
  AI_EXTRACTION: 6,
  SYSTEM_IMPORT: 5,
  MANUAL_ENTRY: 3,     // Mínima prioridade
};

/**
 * Obtém ícone Lucide para a fonte
 */
export function getSourceIcon(source: TimelineSource): React.ReactNode {
  return SOURCE_ICONS[source] || SOURCE_ICONS.SYSTEM_IMPORT;
}

/**
 * Obtém label em português para a fonte
 */
export function getSourceLabel(source: TimelineSource): string {
  return SOURCE_LABELS[source] || source;
}

/**
 * Obtém descrição detalhada (para tooltips)
 */
export function getSourceDescription(source: TimelineSource): string {
  return SOURCE_DESCRIPTIONS[source] || '';
}

/**
 * Obtém variante de badge (para shadcn/ui Badge)
 */
export function getSourceBadgeVariant(
  source: TimelineSource
): 'primary' | 'secondary' | 'outline' {
  const variant = SOURCE_BADGE_VARIANTS[source];
  return (variant as 'primary' | 'secondary' | 'outline') || 'outline';
}

/**
 * Obtém classes Tailwind para cor de prioridade
 */
export function getSourcePriorityColor(source: TimelineSource): string {
  return SOURCE_PRIORITY_COLORS[source] || SOURCE_PRIORITY_COLORS.SYSTEM_IMPORT;
}

/**
 * Obtém prioridade numérica (10 = máxima, 3 = mínima)
 */
export function getSourcePriority(source: TimelineSource): number {
  return SOURCE_PRIORITY[source] || 0;
}

/**
 * Obtém a fonte mais prioritária entre múltiplas
 */
export function getHighestPrioritySource(sources: TimelineSource[]): TimelineSource | null {
  if (sources.length === 0) return null;

  return sources.reduce((highest, current) => {
    return getSourcePriority(current) > getSourcePriority(highest)
      ? current
      : highest;
  });
}

/**
 * Verifica se fonte é JUDIT (espinha dorsal)
 */
export function isJuditSource(source: TimelineSource): boolean {
  return source === 'API_JUDIT';
}

/**
 * Verifica se fonte é IA-generated
 */
export function isAiSource(source: TimelineSource): boolean {
  return source === 'AI_EXTRACTION';
}

/**
 * Formata lista de fontes como texto legível
 * Ex: "JUDIT Oficial, Documento PDF, Análise IA"
 */
export function formatSourcesList(sources: TimelineSource[]): string {
  if (sources.length === 0) return 'Sem fonte';
  if (sources.length === 1) return getSourceLabel(sources[0]);

  return sources.map((s) => getSourceLabel(s)).join(', ');
}

/**
 * Obtém emoji representativo da fonte (para notificações/logs)
 */
export function getSourceEmoji(source: TimelineSource): string {
  const emojis: Record<TimelineSource, string> = {
    API_JUDIT: '⚖️',
    DOCUMENT_UPLOAD: '📄',
    AI_EXTRACTION: '🤖',
    MANUAL_ENTRY: '📝',
    SYSTEM_IMPORT: '📥',
  };

  return emojis[source] || '📌';
}

/**
 * Helper para renderizar badge com ícone e label
 * Retorna JSX simples que pode ser usado em qualquer framework
 */
export function renderSourceBadge(
  source: TimelineSource,
  options?: {
    showDescription?: boolean;
    className?: string;
  }
): {
  icon: React.ReactNode;
  label: string;
  color: string;
  description?: string;
  priority: number;
} {
  return {
    icon: getSourceIcon(source),
    label: getSourceLabel(source),
    color: getSourcePriorityColor(source),
    description: options?.showDescription ? getSourceDescription(source) : undefined,
    priority: getSourcePriority(source),
  };
}

/**
 * Comparar dois sources por prioridade
 * Retorna -1 se a < b, 0 se iguais, 1 se a > b
 */
export function compareSourcesByPriority(
  sourceA: TimelineSource,
  sourceB: TimelineSource
): number {
  const priorityA = getSourcePriority(sourceA);
  const priorityB = getSourcePriority(sourceB);

  if (priorityA < priorityB) return -1;
  if (priorityA > priorityB) return 1;
  return 0;
}

/**
 * Ordena array de sources por prioridade (descendente)
 */
export function sortSourcesByPriority(sources: TimelineSource[]): TimelineSource[] {
  return [...sources].sort((a, b) => compareSourcesByPriority(b, a));
}

/**
 * Debug: Exibir configuração de todas as fontes
 */
export function debugSourcesConfig(): void {
  console.group('📊 Timeline Sources Configuration');

  Object.values(TimelineSource).forEach((source) => {
    log.info({ msg: "\n" });
    log.info({ msg: "Priority: /10" });
    log.info({ msg: "Badge:" });
    log.info({ msg: "Description:" });
  });

  console.groupEnd();
}

// Export tipo para conveniência
export type SourceBadgeVariant = 'primary' | 'secondary' | 'outline';
