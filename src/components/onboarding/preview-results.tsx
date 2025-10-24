'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, AlertCircle, FileText, User, DollarSign, Calendar } from 'lucide-react';

interface PreviewData {
  modelUsed?: string;
  confidence?: number;
  processNumber?: string;
  parties?: string[];
  subject?: string;
  object?: string; // Objeto jurídico específico extraído pelo Gemini
  claimValue?: number;
  dates?: string[];
  risks?: string[];
  summary?: string;
}

interface PreviewResultsProps {
  data: PreviewData;
  className?: string;
}

export function PreviewResults({ data, className }: PreviewResultsProps) {
  if (!data) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Cabeçalho com Modelo e Confiança */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Análise com</p>
              <p className="text-lg font-semibold text-gray-900">{data.modelUsed || 'Gemini'}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Confiança</p>
              <Badge
                variant="secondary"
                className={`text-sm ${
                  (data.confidence || 0) > 0.8
                    ? 'bg-green-100 text-green-800'
                    : (data.confidence || 0) > 0.6
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-orange-100 text-orange-800'
                }`}
              >
                {((data.confidence || 0) * 100).toFixed(0)}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Número do Processo */}
      {data.processNumber && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Número do Processo</p>
                <p className="text-lg font-semibold text-gray-900 font-mono">{data.processNumber}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Partes Envolvidas */}
      {data.parties && data.parties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-5 h-5 text-blue-600" />
              Partes Envolvidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.parties.map((party, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700">{party}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assunto e Valor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.subject && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assunto</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">{data.subject}</p>
            </CardContent>
          </Card>
        )}

        {data.claimValue && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="w-5 h-5 text-green-600" />
                Valor da Causa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">
                R$ {data.claimValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Objeto Jurídico */}
      {data.object && (
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader>
            <CardTitle className="text-base">Objeto do Processo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 leading-relaxed">{data.object}</p>
          </CardContent>
        </Card>
      )}

      {/* Datas Importantes */}
      {data.dates && data.dates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-5 h-5 text-blue-600" />
              Datas Importantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.dates.map((date, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-700">{date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo */}
      {data.summary && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="text-base">Resumo Executivo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 leading-relaxed">{data.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Riscos Identificados */}
      {data.risks && data.risks.length > 0 && (
        <Card className="border-l-4 border-l-red-500 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-900">
              <AlertCircle className="w-5 h-5" />
              Possíveis Riscos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.risks.map((risk, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-red-800">
                  <span className="text-red-600 mt-1">⚠</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Componente compacto para exibição rápida em cards
 */
export function PreviewResultsCompact({ data }: { data: PreviewData }) {
  return (
    <div className="space-y-2">
      {data.processNumber && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600">Processo:</span>
          <span className="text-sm font-mono text-gray-900">{data.processNumber}</span>
        </div>
      )}

      {data.confidence && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600">Confiança:</span>
          <span className="text-sm font-semibold text-gray-900">
            {(data.confidence * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {data.claimValue && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600">Valor:</span>
          <span className="text-sm font-semibold text-green-700">
            R$ {data.claimValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {data.parties && data.parties.length > 0 && (
        <div>
          <span className="text-xs font-medium text-gray-600">Partes ({data.parties.length})</span>
          <p className="text-xs text-gray-700 mt-1">
            {data.parties.join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
