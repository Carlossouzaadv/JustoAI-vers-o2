// ================================
// BIBLIOTECA DE ÍCONES SEGUROS PARA WINDOWS
// ================================
// Sistema especial para evitar problemas de encoding no Windows

export const ICONS = {
  // Status e feedback
  SUCCESS: '✓',
  ERROR: '✗',
  WARNING: '!',
  INFO: 'i',
  LOADING: '...',

  // Navegação
  ARROW_LEFT: '<',
  ARROW_RIGHT: '>',
  ARROW_UP: '^',
  ARROW_DOWN: 'v',

  // Ações
  SAVE: '💾',
  EDIT: '✏️',
  DELETE: '🗑️',
  ADD: '+',
  REMOVE: '-',
  SEARCH: '🔍',

  // Estados
  CIRCLE_FILLED: '●',
  CIRCLE_EMPTY: '○',
  STAR: '★',
  STAR_EMPTY: '☆',

  // Jurídico específico
  PROCESS: '⚖️',
  DOCUMENT: '📄',
  CLIENT: '👤',
  MONEY: '💰',
  TIME: '⏰',
  CALENDAR: '📅',

  // Interface
  MENU: '☰',
  HOME: '🏠',
  SETTINGS: '⚙️',
  REPORTS: '📊',

  // Performance
  ROCKET: '🚀',
  CLEAN: '🧹',
  CHARTS: '📈'
} as const;

export const UI_TEXT = {
  SUCCESS: `${ICONS.SUCCESS} Sucesso`,
  ERROR: `${ICONS.ERROR} Erro`,
  WARNING: `${ICONS.WARNING} Atenção`,
  LOADING: `${ICONS.LOADING} Carregando`,
  PROCESS_COMPLETE: `${ICONS.SUCCESS} Análise completa`,
  PROCESS_PARTIAL: `${ICONS.WARNING} Monitorando`,
  PROCESS_ATTENTION: `${ICONS.ERROR} Atenção necessária`
} as const;

export const EMOJIS = {
  THUMBS_UP: '👍',
  SMILE: '😊',
  FIRE: '🔥',
  ROCKET: '🚀'
} as const;

// Hook para uso condicional de ícones
export function useIcon(iconName: keyof typeof ICONS, fallback: string = ''): string {
  try {
    return ICONS[iconName] || fallback;
  } catch {
    return fallback;
  }
}