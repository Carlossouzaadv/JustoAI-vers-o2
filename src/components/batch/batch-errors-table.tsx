// ================================================================
// BATCH ERRORS TABLE - Component
// ================================================================
// Exibe tabela com erros mais comuns encontrados

'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface BatchErrorDetail {
  field: string;
  _error: string;
  row?: number;
  retryCount?: number;
}

interface BatchErrorsTableProps {
  errors: BatchErrorDetail[];
  errorSummary: Record<string, number>;
  totalErrors: number;
}

export function BatchErrorsTable({
  errors,
  errorSummary,
  totalErrors,
}: BatchErrorsTableProps) {
  if (totalErrors === 0) {
    return (
      <Card className="p-6 text-center">
        <div className="text-gray-500">
          <p className="text-sm">Nenhum erro encontrado durante o processamento</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold text-gray-900">
            Erros Encontrados ({totalErrors})
          </h3>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Exibindo os erros mais comuns durante o processamento
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-left">Campo</TableHead>
              <TableHead className="text-left">Erro</TableHead>
              <TableHead className="text-right">Ocorrências</TableHead>
              {errors.some((e) => e.row) && <TableHead className="text-right">Linha</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {errors.map((error, idx) => {
              const key = `${error.field}: ${error._error}`;
              const count = errorSummary[key] || 0;

              return (
                <TableRow key={idx} className="hover:bg-gray-50">
                  <TableCell className="font-mono text-sm text-blue-600">
                    {error.field}
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">
                    {error._error}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {count}
                    </span>
                  </TableCell>
                  {error.row && (
                    <TableCell className="text-right text-sm text-gray-600">
                      {error.row}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
