import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Shield,
  RefreshCw,
  XCircle,
  Info
} from 'lucide-react';

export const ICONS = {
  SYNC: <RefreshCw className="h-4 w-4" />,
  WARNING: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  ERROR: <XCircle className="h-4 w-4 text-red-500" />,
  SUCCESS: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  CLOCK: <Clock className="h-4 w-4" />,
  MONEY: <DollarSign className="h-4 w-4" />,
  SHIELD: <Shield className="h-4 w-4" />,
  INFO: <Info className="h-4 w-4" />,
  CREDIT_CARD: <CreditCard className="h-4 w-4" />,
  FILE: <FileText className="h-4 w-4" />,
  ARROW_LEFT: <ArrowLeft className="h-4 w-4" />,
  ARROW_RIGHT: <ArrowRight className="h-4 w-4" />,
  CHECK: <Check className="h-4 w-4" />
};