/**
 * Pagination Component
 * Componente de paginação otimizado para grandes datasets
 */

'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
  showInfo?: boolean;
  showFirstLast?: boolean;
  maxVisiblePages?: number;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage = 10,
  onPageChange,
  showInfo = true,
  showFirstLast = true,
  maxVisiblePages = 7,
  disabled = false,
  size = 'md',
  className,
}: PaginationProps) {
  // Calcular páginas visíveis
  const getVisiblePages = () => {
    const pages: (number | 'ellipsis')[] = [];

    if (totalPages <= maxVisiblePages) {
      // Mostrar todas as páginas se há poucas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const sidePages = Math.floor((maxVisiblePages - 3) / 2); // -3 para primeira, última e atual

      if (currentPage <= sidePages + 2) {
        // Próximo do início
        for (let i = 1; i <= Math.max(maxVisiblePages - 2, 1); i++) {
          pages.push(i);
        }
        if (totalPages > maxVisiblePages - 1) {
          pages.push('ellipsis');
          pages.push(totalPages);
        }
      } else if (currentPage >= totalPages - sidePages - 1) {
        // Próximo do fim
        pages.push(1);
        if (totalPages > maxVisiblePages - 1) {
          pages.push('ellipsis');
        }
        for (let i = Math.max(totalPages - maxVisiblePages + 3, 2); i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // No meio
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - sidePages; i <= currentPage + sidePages; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const visiblePages = getVisiblePages();

  // Tamanhos
  const sizeClasses = {
    sm: 'h-8 px-2 text-sm',
    md: 'h-9 px-3',
    lg: 'h-10 px-4',
  };

  const buttonSize = sizeClasses[size];

  // Informações de itens
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems || 0);

  return (
    <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-4', className)}>
      {/* Informações dos itens */}
      {showInfo && totalItems && (
        <div className="text-sm text-muted-foreground order-2 sm:order-1">
          Mostrando {startItem} a {endItem} de {totalItems.toLocaleString()} itens
        </div>
      )}

      {/* Controles de paginação */}
      <div className="flex items-center space-x-1 order-1 sm:order-2">
        {/* Primeira página */}
        {showFirstLast && currentPage > 1 && (
          <Button
            variant="outline"
            size="sm"
            className={buttonSize}
            onClick={() => onPageChange(1)}
            disabled={disabled || currentPage === 1}
            title="Primeira página"
          >
            <span className="sr-only">Primeira página</span>
            ««
          </Button>
        )}

        {/* Página anterior */}
        <Button
          variant="outline"
          size="sm"
          className={buttonSize}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={disabled || currentPage === 1}
          title="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="sr-only">Página anterior</span>
        </Button>

        {/* Números das páginas */}
        {visiblePages.map((page, index) => {
          if (page === 'ellipsis') {
            return (
              <div
                key={`ellipsis-${index}`}
                className={cn(
                  'flex items-center justify-center',
                  buttonSize,
                  'text-muted-foreground'
                )}
              >
                <MoreHorizontal className="w-4 h-4" />
                <span className="sr-only">Mais páginas</span>
              </div>
            );
          }

          const isCurrentPage = page === currentPage;

          return (
            <Button
              key={page}
              variant={isCurrentPage ? 'default' : 'outline'}
              size="sm"
              className={cn(
                buttonSize,
                isCurrentPage && 'pointer-events-none'
              )}
              onClick={() => onPageChange(page)}
              disabled={disabled}
              aria-current={isCurrentPage ? 'page' : undefined}
              title={`Página ${page}`}
            >
              {page}
            </Button>
          );
        })}

        {/* Próxima página */}
        <Button
          variant="outline"
          size="sm"
          className={buttonSize}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={disabled || currentPage === totalPages}
          title="Próxima página"
        >
          <ChevronRight className="w-4 h-4" />
          <span className="sr-only">Próxima página</span>
        </Button>

        {/* Última página */}
        {showFirstLast && currentPage < totalPages && (
          <Button
            variant="outline"
            size="sm"
            className={buttonSize}
            onClick={() => onPageChange(totalPages)}
            disabled={disabled || currentPage === totalPages}
            title="Última página"
          >
            <span className="sr-only">Última página</span>
            »»
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Hook para gerenciar estado da paginação
 */
export function usePagination({
  totalItems,
  itemsPerPage = 10,
  initialPage = 1,
}: {
  totalItems: number;
  itemsPerPage?: number;
  initialPage?: number;
}) {
  const [currentPage, setCurrentPage] = React.useState(initialPage);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Garantir que a página atual é válida
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Calcular índices para slice de array
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  return {
    currentPage,
    totalPages,
    itemsPerPage,
    startIndex,
    endIndex,
    handlePageChange,
    canGoBack: currentPage > 1,
    canGoForward: currentPage < totalPages,
  };
}

/**
 * Componente de seletor de itens por página
 */
interface PageSizeSelectProps {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  options?: number[];
  className?: string;
}

export function PageSizeSelect({
  pageSize,
  onPageSizeChange,
  options = [10, 20, 50, 100],
  className,
}: PageSizeSelectProps) {
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <span className="text-sm text-muted-foreground">Itens por página:</span>
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className="text-sm border border-input bg-background px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
  );
}