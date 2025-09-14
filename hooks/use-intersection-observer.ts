/**
 * useIntersectionObserver Hook
 * Hook para lazy loading e observação de elementos na viewport
 */

'use client';

import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  rootMargin?: string;
  root?: Element | null;
  triggerOnce?: boolean;
}

interface UseIntersectionObserverReturn {
  isInView: boolean;
  entry: IntersectionObserverEntry | null;
  ref: React.RefObject<HTMLElement>;
}

export function useIntersectionObserver({
  threshold = 0.1,
  rootMargin = '0px',
  root = null,
  triggerOnce = true,
}: UseIntersectionObserverOptions = {}): UseIntersectionObserverReturn {
  const [isInView, setIsInView] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !window.IntersectionObserver) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setEntry(entry);
        setIsInView(entry.isIntersecting);

        if (entry.isIntersecting && triggerOnce) {
          observer.unobserve(element);
        }
      },
      {
        threshold,
        rootMargin,
        root,
      }
    );

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [threshold, rootMargin, root, triggerOnce]);

  return {
    isInView,
    entry,
    ref: elementRef,
  };
}

/**
 * Hook para carregamento lazy de listas
 */
interface UseLazyListOptions {
  itemsPerPage?: number;
  threshold?: number;
  rootMargin?: string;
  initialItems?: number;
}

export function useLazyList<T>(
  items: T[],
  {
    itemsPerPage = 20,
    threshold = 0.1,
    rootMargin = '100px',
    initialItems = 10,
  }: UseLazyListOptions = {}
) {
  const [visibleCount, setVisibleCount] = useState(initialItems);
  const [isLoading, setIsLoading] = useState(false);

  const { isInView, ref } = useIntersectionObserver({
    threshold,
    rootMargin,
    triggerOnce: false,
  });

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  useEffect(() => {
    if (isInView && hasMore && !isLoading) {
      setIsLoading(true);

      // Simular delay para carregamento
      const timer = setTimeout(() => {
        setVisibleCount(prev => Math.min(prev + itemsPerPage, items.length));
        setIsLoading(false);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isInView, hasMore, isLoading, itemsPerPage, items.length]);

  return {
    visibleItems,
    hasMore,
    isLoading,
    loadMoreRef: ref,
    totalItems: items.length,
    visibleCount,
  };
}

/**
 * Hook para lazy loading de componentes
 */
export function useLazyComponent<T>(
  importFunction: () => Promise<{ default: T }>,
  fallback?: T
) {
  const [component, setComponent] = useState<T | null>(fallback || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { isInView, ref } = useIntersectionObserver({
    triggerOnce: true,
    rootMargin: '50px',
  });

  useEffect(() => {
    if (isInView && !component && !isLoading) {
      setIsLoading(true);

      importFunction()
        .then(module => {
          setComponent(module.default);
          setError(null);
        })
        .catch(err => {
          setError(err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isInView, component, isLoading, importFunction]);

  return {
    component,
    isLoading,
    error,
    ref,
  };
}