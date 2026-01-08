// Complete ICONS library for JustoAI
// Supports both React components and console logging

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  Brain,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  Coins,
  CreditCard,
  Database,
  DollarSign,
  Download,
  Edit,
  Eye,
  FileText,
  Folder,
  Heart,
  Home,
  Info,
  Instagram,
  Linkedin,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Monitor,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Scan,
  Search,
  Server,
  Settings,
  Shield,
  Sparkles,
  Square,
  Star,
  Timer,
  Trash2,
  Upload,
  User,
  Users,
  Webhook,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

// String-based icons for console logging (workers, server-side)
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

// React component-based icons for UI
export const IconComponents = {
  SUCCESS: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  ERROR: <XCircle className="h-4 w-4 text-red-500" />,
  WARNING: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  INFO: <Info className="h-4 w-4 text-blue-500" />,
  LOADING: <Loader2 className="h-4 w-4 animate-spin" />,
  CHECK: <Check className="h-4 w-4" />,
  CROSS: <X className="h-4 w-4" />,

  ARROW_LEFT: <ArrowLeft className="h-4 w-4" />,
  ARROW_RIGHT: <ArrowRight className="h-4 w-4" />,
  ARROW_UP: <ArrowUp className="h-4 w-4" />,
  ARROW_DOWN: <ArrowDown className="h-4 w-4" />,

  ADD: <Plus className="h-4 w-4" />,
  PLUS: <Plus className="h-4 w-4" />,
  DELETE: <Trash2 className="h-4 w-4" />,
  EDIT: <Edit className="h-4 w-4" />,
  SAVE: <Save className="h-4 w-4" />,
  DOWNLOAD: <Download className="h-4 w-4" />,
  UPLOAD: <Upload className="h-4 w-4" />,
  SEARCH: <Search className="h-4 w-4" />,
  SCAN: <Scan className="h-4 w-4" />,
  SYNC: <RefreshCw className="h-4 w-4" />,
  PLAY: <Play className="h-4 w-4" />,

  CLOCK: <Clock className="h-4 w-4" />,
  TIMER: <Timer className="h-4 w-4" />,
  CALENDAR: <Calendar className="h-4 w-4" />,
  FILE: <FileText className="h-4 w-4" />,
  FOLDER: <Folder className="h-4 w-4" />,
  MAIL: <Mail className="h-4 w-4" />,
  SHIELD: <Shield className="h-4 w-4" />,
  LOCK: <Lock className="h-4 w-4" />,
  EYE: <Eye className="h-4 w-4" />,
  STAR: <Star className="h-4 w-4" />,
  HEART: <Heart className="h-4 w-4" />,
  LOCATION: <MapPin className="h-4 w-4" />,
  HOME: <Home className="h-4 w-4" />,
  BUILDING: <Building className="h-4 w-4" />,

  USER: <User className="h-4 w-4" />,
  USERS: <Users className="h-4 w-4" />,

  MONEY: <DollarSign className="h-4 w-4" />,
  COINS: <Coins className="h-4 w-4" />,
  CREDIT_CARD: <CreditCard className="h-4 w-4" />,

  DATABASE: <Database className="h-4 w-4" />,
  SERVER: <Server className="h-4 w-4" />,
  WEBHOOK: <Webhook className="h-4 w-4" />,
  MONITOR: <Monitor className="h-4 w-4" />,
  SETTINGS: <Settings className="h-4 w-4" />,
  BRAIN: <Brain className="h-4 w-4" />,
  SPARKLES: <Sparkles className="h-4 w-4" />,
  ROCKET: <Rocket className="h-4 w-4" />,

  ACTIVITY: <Activity className="h-4 w-4" />,
  ALERT: <Bell className="h-4 w-4" />,

  CIRCLE_FILLED: <CircleDot className="h-4 w-4" />,
  CIRCLE_EMPTY: <Circle className="h-4 w-4" />,
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