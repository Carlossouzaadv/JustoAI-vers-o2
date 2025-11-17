// ================================================================
// EXPORT BUTTON COMPONENT
// Botão para exportar relatórios em diferentes formatos
// ================================================================

'use client';

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { format } from 'date-fns';

interface ExportButtonProps {
  data: unknown;
  filename?: string;
  formats?: ('csv' | 'json' | 'pdf')[];
}

// Type definitions for export data structure
interface BreakdownItem {
  operationType: unknown;
  count: unknown;
  totalCost: unknown;
  avgCost: unknown;
}

interface DailyCostItem {
  date: unknown;
  cost: unknown;
  operations: unknown;
}

interface ExportData {
  summary?: Record<string, unknown>;
  breakdown?: unknown[];
  dailyCosts?: unknown[];
}

// Type guard to validate data structure
function isExportData(data: unknown): data is ExportData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  return true;
}

// Type guard to validate breakdown items
function isBreakdownItem(item: unknown): item is BreakdownItem {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const obj = item as Record<string, unknown>;
  return (
    'operationType' in obj &&
    'count' in obj &&
    'totalCost' in obj &&
    'avgCost' in obj
  );
}

// Type guard to validate daily cost items
function isDailyCostItem(item: unknown): item is DailyCostItem {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const obj = item as Record<string, unknown>;
  return (
    'date' in obj &&
    'cost' in obj &&
    'operations' in obj
  );
}

export function ExportButton({
  data,
  filename = 'judit-report',
  formats = ['csv', 'json'],
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const exportToCSV = (data: unknown) => {
    // Convert data to CSV format
    let csvContent = '';

    // Validate data structure
    if (!isExportData(data)) {
      console.error('Invalid export data structure');
      return;
    }

    const exportData = data as Record<string, unknown>;

    // Process summary section
    if (exportData.summary !== undefined && exportData.summary !== null) {
      const summary = exportData.summary;
      if (typeof summary === 'object') {
        csvContent += 'RESUMO\n';
        csvContent += Object.entries(summary)
          .map(([key, value]) => `${key},${value}`)
          .join('\n');
        csvContent += '\n\n';
      }
    }

    // Process breakdown section
    if (exportData.breakdown !== undefined && exportData.breakdown !== null) {
      if (Array.isArray(exportData.breakdown)) {
        csvContent += 'BREAKDOWN POR TIPO\n';
        csvContent += 'Tipo,Quantidade,Custo Total,Custo Médio\n';
        csvContent += exportData.breakdown
          .filter(isBreakdownItem)
          .map((item) =>
            [item.operationType, item.count, item.totalCost, item.avgCost].join(',')
          )
          .join('\n');
        csvContent += '\n\n';
      }
    }

    // Process daily costs section
    if (exportData.dailyCosts !== undefined && exportData.dailyCosts !== null) {
      if (Array.isArray(exportData.dailyCosts)) {
        csvContent += 'CUSTOS DIÁRIOS\n';
        csvContent += 'Data,Custo,Operações\n';
        csvContent += exportData.dailyCosts
          .filter(isDailyCostItem)
          .map((item) => [item.date, item.cost, item.operations].join(','))
          .join('\n');
      }
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

  const exportToJSON = (data: unknown) => {
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

  const exportToPDF = async (data: unknown) => {
    try {
      if (!isExportData(data)) {
        console.error('Invalid export data structure for PDF');
        alert('Erro: dados inválidos para exportação');
        return;
      }

      const exportData = data as Record<string, unknown>;

      // Prepare request payload
      const payload = {
        title: 'Relatório de Dados',
        summary: exportData.summary || {},
        breakdown: exportData.breakdown || [],
        dailyCosts: exportData.dailyCosts || [],
      };

      // Call API endpoint
      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Get HTML blob from response
      const blob = await response.blob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-${format(new Date(), 'yyyy-MM-dd')}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Open in new tab so user can Print > Save as PDF (without revoking URL first)
      const newTab = window.open(url, '_blank');
      if (newTab) {
        setTimeout(() => {
          newTab.print();
          // Revoke after opening
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 2000);
        }, 500);
      } else {
        // Fallback: revoke immediately if can't open new tab
        URL.revokeObjectURL(url);
      }

      console.log('PDF export initiated - user can print to PDF');
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Erro ao exportar para PDF. Tente novamente.');
    }
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
        exportToPDF(data);
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
