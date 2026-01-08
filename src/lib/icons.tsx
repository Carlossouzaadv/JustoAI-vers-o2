// Complete ICONS library for JustoAI
// String-based icons for universal use (works in Node.js workers and React)

// String-based icons for console logging (workers, server-side) and UI text
export const ICONS = {
  // Status
  SUCCESS: '✓',
  ERROR: '✗',
  WARNING: '⚠',
  INFO: 'ℹ',
  LOADING: '⟳',
  CHECK: '✓',
  CROSS: '✗',
  DONE: '✓',

  // Navigation
  ARROW_LEFT: '←',
  ARROW_RIGHT: '→',
  ARROW_UP: '↑',
  ARROW_DOWN: '↓',
  ARROW: '→',

  // Actions
  ADD: '+',
  PLUS: '+',
  DELETE: '🗑',
  EDIT: '✎',
  SAVE: '💾',
  DOWNLOAD: '⬇',
  UPLOAD: '⬆',
  SEARCH: '🔍',
  SCAN: '📡',
  RESET: '↺',
  RESTART: '↻',
  SYNC: '🔄',
  PLAY: '▶',
  STOP: '■',
  GENERATE: '⚡',
  EXTRACT: '📤',
  CLEAN: '🧹',
  CLEANUP: '🧹',

  // Objects
  CLOCK: '🕐',
  TIME: '🕐',
  TIMER: '⏱',
  CALENDAR: '📅',
  DOCUMENT: '📄',
  FILE: '📄',
  FOLDER: '📁',
  MAIL: '✉',
  SHIELD: '🛡',
  LOCK: '🔒',
  EYE: '👁',
  STAR: '⭐',
  STAR_EMPTY: '☆',
  HEART: '❤',
  LOCATION: '📍',
  HOME: '🏠',
  BUILDING: '🏢',

  // People & Entities
  USER: '👤',
  USERS: '👥',
  CLIENT: '👤',
  ADMIN: '👑',

  // Money & Business
  MONEY: '$',
  COINS: '💰',
  CREDIT: '💳',
  CREDIT_CARD: '💳',
  COST: '💵',

  // Tech & System
  DATABASE: '🗄',
  SERVER: '🖥',
  CACHE: '📦',
  WEBHOOK: '🔗',
  MONITOR: '📺',
  SETTINGS: '⚙',
  ROBOT: '🤖',
  AI: '🤖',
  BRAIN: '🧠',
  SPARKLES: '✨',
  ROCKET: '🚀',

  // Process & Work
  PROCESS: '⚙',
  WORKER: '👷',
  ACTIVITY: '📊',
  CHART: '📈',
  CHARTS: '📊',
  REPORT: '📋',
  REPORTS: '📋',
  DECISION: '⚖',
  TELEMETRY: '📡',
  STREAM: '🌊',
  HEALTH: '💚',

  // Alerts & Priority
  ALERT: '🔔',
  NOTIFICATION: '🔔',
  URGENT: '🚨',
  EMERGENCY: '🆘',
  FATAL: '💀',
  WARN: '⚠',

  // Circles
  CIRCLE_FILLED: '●',
  CIRCLE_EMPTY: '○',

  // System Import
  SYSTEM_IMPORT: '📥',

  // Social
  WHATSAPP: '📱',
  INSTAGRAM: '📷',
  LINKEDIN: '💼',
} as const;

// Legacy support - useIcon hook for safe icon access
export function useIcon(iconName: keyof typeof ICONS, fallback: string = ''): string {
  try {
    return ICONS[iconName] || fallback;
  } catch {
    return fallback;
  }
}

// Export type for icon names
export type IconName = keyof typeof ICONS;

// UI Text strings for consistent messaging
export const UI_TEXT = {
  // Status messages
  SUCCESS: '✓ Sucesso',
  ERROR: '✗ Erro',
  WARNING: '⚠ Atenção',
  LOADING: '⟳ Carregando...',

  // Process status
  PROCESS_COMPLETE: 'Análise completa',
  PROCESS_PARTIAL: 'Monitorando - falta análise',
  PROCESS_ATTENTION: 'Atenção necessária',

  // Common actions
  SAVE_SUCCESS: '✓ Salvo com sucesso',
  DELETE_SUCCESS: '✓ Excluído com sucesso',
  UPDATE_SUCCESS: '✓ Atualizado com sucesso',

  // Error messages
  GENERIC_ERROR: '✗ Ocorreu um erro',
  NETWORK_ERROR: '✗ Erro de conexão',
  VALIDATION_ERROR: '✗ Dados inválidos',
} as const;