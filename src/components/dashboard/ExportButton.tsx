// ================================================================
// EXPORT BUTTON COMPONENT
// Botão para exportar relatórios em diferentes formatos
// ================================================================

'use client';

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { format } from 'date-fns';

interface ExportButtonProps {
  data: any;
  filename?: string;
  formats?: ('csv' | 'json' | 'pdf')[];
}

export function ExportButton({
  data,
  filename = 'judit-report',
  formats = ['csv', 'json'],
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const exportToCSV = (data: any) => {
    // Convert data to CSV format
    let csvContent = '';

    if (data.summary) {
      csvContent += 'RESUMO\n';
      csvContent += Object.entries(data.summary)
        .map(([key, value]) => `${key},${value}`)
        .join('\n');
      csvContent += '\n\n';
    }

    if (data.breakdown) {
      csvContent += 'BREAKDOWN POR TIPO\n';
      csvContent += 'Tipo,Quantidade,Custo Total,Custo Médio\n';
      csvContent += data.breakdown
        .map((item: any) =>
          [item.operationType, item.count, item.totalCost, item.avgCost].join(',')
        )
        .join('\n');
      csvContent += '\n\n';
    }

    if (data.dailyCosts) {
      csvContent += 'CUSTOS DIÁRIOS\n';
      csvContent += 'Data,Custo,Operações\n';
      csvContent += data.dailyCosts
        .map((item: any) => [item.date, item.cost, item.operations].join(','))
        .join('\n');
    }

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = (data: any) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${filename}-${format(new Date(), 'yyyy-MM-dd')}.json`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = (format: 'csv' | 'json' | 'pdf') => {
    switch (format) {
      case 'csv':
        exportToCSV(data);
        break;
      case 'json':
        exportToJSON(data);
        break;
      case 'pdf':
        // TODO: Implement PDF export
        alert('Exportação para PDF será implementada em breve');
        break;
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        <Download className="w-4 h-4" />
        Exportar
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              {formats.includes('csv') && (
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Exportar como CSV
                </button>
              )}
              {formats.includes('json') && (
                <button
                  onClick={() => handleExport('json')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Exportar como JSON
                </button>
              )}
              {formats.includes('pdf') && (
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Exportar como PDF
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
