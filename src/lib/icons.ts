// ================================
// BIBLIOTECA DE ÍCONES SEGUROS PARA WINDOWS
// ================================
// Sistema especial para evitar problemas de encoding no Windows

export const ICONS = {
  // Status e feedback
  SUCCESS: '✓',
  ERROR: '✗',
  WARNING: '!',
  WARN: '!',
  INFO: 'i',
  LOADING: '...',
  DONE: '✓',
  FATAL: '✗',
  PLUS: '+',
  STREAM: '📡',

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
  EYE: '👁️',

  // Estados
  CIRCLE_FILLED: '●',
  CIRCLE_EMPTY: '○',
  STAR: '★',
  STAR_EMPTY: '☆',

  // Jurídico específico
  PROCESS: '⚖️',
  DOCUMENT: '📄',
  CLIENT: '👤',
  USER: '👤',
  USERS: '👥',
  BUILDING: '🏢',
  MONEY: '💰',
  COINS: '🪙',
  TIME: '⏰',
  CALENDAR: '📅',
  FOLDER: '📁',

  // Interface
  MENU: '☰',
  HOME: '🏠',
  SETTINGS: '⚙️',
  REPORT: '📊',
  REPORTS: '📊',

  // Performance
  ROCKET: '🚀',
  CACHE: '💾',
  CLEAN: '🧹',
  CLEANUP: '🧹',
  CHART: '📈',
  CHARTS: '📈',
  COMPARE: '⚖️',
  URGENT: '🚨',
  ACTIVITY: '⚡',
  DECISION: '⚖️',
  NOTIFICATION: '🔔',
  CLOCK: '⏰',
  MAIL: '📧',
  SYNC: '🔄',
  UPLOAD: '📤',
  DOWNLOAD: '📥',
  EXTRACT: '📋',
  SPARKLES: '✨',
  ROBOT: '🤖',
  HEART: '❤️',
  LOCATION: '📍',
  SHIELD: '🛡️',
  LOCK: '🔒',
  SERVER: '💾',
  PHONE: '📞',
  CHECK: '✅',
  BRAIN: '🧠',
  MONITOR: '🖥️',
  WHATSAPP: '📱',
  PLAY: '▶️',
  LINKEDIN: '💼',
  TWITTER: '🐦',
  YOUTUBE: '📺',
  INSTAGRAM: '📷',
  AI: '🤖',
  MANUAL: '👋',
  SCAN: '🔍',
  TARGET: '🎯',
  DATABASE: '🗄️',
  WORKER: '⚙️',
  BATCH: '📦',
  GENERATE: '⚡',
  TELEMETRY: '📊',
  COST: '💰',
  ALERT: '🚨',
  ADMIN: '👑',
  CREDIT: '💳',
  WEBHOOK: '🔗',
  RESTART: '🔄',
  RESET: '↩️',
  STOP: '⏹️',
  EMERGENCY: '🆘',
  HEALTH: '💚'
} as const;

// UI_TEXT is defined separately to avoid minification issues with template literals
// Template literals with object references can cause TDZ violations during minification
export const UI_TEXT = {
  SUCCESS: '✓ Sucesso',
  ERROR: '✗ Erro',
  WARNING: '! Atenção',
  LOADING: '... Carregando',
  PROCESS_COMPLETE: '✓ Análise completa',
  PROCESS_PARTIAL: '! Monitorando',
  PROCESS_ATTENTION: '✗ Atenção necessária'
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