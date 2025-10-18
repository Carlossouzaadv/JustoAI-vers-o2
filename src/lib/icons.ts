/**
 * Icon library exporting emoji-based icons for consistent UI
 * Used throughout the application for dashboard, components, and pages
 */

export const ICONS = {
  // Navigation & UI
  HOME: '🏠',
  MENU: '☰',
  SETTINGS: '⚙️',
  SEARCH: '🔍',
  FILTER: '⊕',
  CLOSE: '✕',
  BACK: '←',
  NEXT: '→',

  // Arrows
  ARROW_UP: '↑',
  ARROW_DOWN: '↓',
  ARROW_LEFT: '←',
  ARROW_RIGHT: '→',

  // Actions
  ADD: '➕',
  DELETE: '🗑️',
  EDIT: '✏️',
  SAVE: '💾',
  CLEAR: '🗑️',
  RESET: '🔄',
  SYNC: '🔄',
  UPDATE: '🔄',

  // Status & States
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  LOADING: '⏳',
  STATUS: '●',
  EMERGENCY: '🚨',

  // Business Icons
  PROCESS: '⚙️',
  CLIENT: '👤',
  USER: '👥',
  ADMIN: '👨‍💼',
  TEAM: '👨‍💻',
  DOCUMENT: '📄',
  ATTACHMENT: '📎',
  UPLOAD: '📤',
  DOWNLOAD: '📥',
  FILE: '📋',
  FOLDER: '📁',

  // Financial
  MONEY: '💰',
  CREDIT: '💳',
  PAYMENT: '💵',
  BILLING: '📊',

  // Time & Calendar
  CALENDAR: '📅',
  CLOCK: '🕐',
  TIME: '⏱️',

  // Analytics & Reporting
  CHART: '📊',
  REPORT: '📈',
  REPORTS: '📑',
  ANALYTICS: '📊',
  DATA: '📊',

  // Communication
  MAIL: '📧',
  MESSAGE: '💬',
  BELL: '🔔',
  NOTIFICATION: '🔔',

  // Actions & Controls
  PLAY: '▶️',
  STOP: '⏹️',
  PAUSE: '⏸️',
  RESTART: '🔃',
  REFRESH: '🔄',

  // Utility
  STAR: '⭐',
  HEART: '❤️',
  BOOKMARK: '🔖',
  PIN: '📌',
  FLAG: '🚩',

  // Technology
  ROBOT: '🤖',
  BRAIN: '🧠',
  AI: '🤖',
  SPARKLES: '✨',
  LIGHTNING: '⚡',

  // Organization
  BUILDING: '🏢',
  LOCATION: '📍',
  LINK: '🔗',
  WEBHOOK: '🪝',

  // Forms & Inputs
  CHECK: '✓',
  CHECKBOX: '☐',
  CIRCLE_EMPTY: '○',
  CIRCLE_FILLED: '●',
  RADIO: '◯',

  // Actions
  GENERATE: '✨',
  DOWNLOAD_REPORT: '📥',
  EXPORT: '📤',
  IMPORT: '📥',
  PRINT: '🖨️',
  SHARE: '📤',

  // Security
  SHIELD: '🛡️',
  LOCK: '🔒',
  UNLOCK: '🔓',
  KEY: '🔑',

  // Social
  INSTAGRAM: '📷',
  LINKEDIN: '💼',
  TWITTER: '𝕏',
  GITHUB: '🐙',

  // Monitor & System
  MONITOR: '🖥️',
  DESKTOP: '💻',
  MOBILE: '📱',
  HEALTH: '❤️',

  // Misc
  ROCKET: '🚀',
  FIRE: '🔥',
  ICE: '🧊',
  CLEAN: '🧹',
} as const;

// Type for icon keys
export type IconKey = keyof typeof ICONS;
