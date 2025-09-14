/**
 * Lazy Image Component
 * Componente otimizado para carregamento lazy de imagens
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  placeholder?: string;
  blurDataURL?: string;
  quality?: number;
  priority?: boolean;
  sizes?: string;
  onLoad?: () => void;
  onError?: () => void;
  className?: string;
  containerClassName?: string;
  loadingClassName?: string;
  errorClassName?: string;
}

export function LazyImage({
  src,
  alt,
  fallbackSrc = '/images/placeholder.svg',
  placeholder,
  blurDataURL,
  quality = 85,
  priority = false,
  sizes = '100vw',
  onLoad,
  onError,
  className,
  containerClassName,
  loadingClassName,
  errorClassName,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer para lazy loading
  useEffect(() => {
    if (priority || isInView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority, isInView]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Determinar src a ser usado
  const imageSrc = hasError ? fallbackSrc : src;
  const shouldShowPlaceholder = !isLoaded && !hasError;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden',
        containerClassName
      )}
      {...props}
    >
      {/* Placeholder/Loading state */}
      {shouldShowPlaceholder && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800',
            loadingClassName
          )}
        >
          {placeholder ? (
            <span className="text-gray-400 text-sm">{placeholder}</span>
          ) : (
            <div className="animate-pulse">
              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
            </div>
          )}
        </div>
      )}

      {/* Blur placeholder se fornecido */}
      {blurDataURL && !isLoaded && (
        <img
          src={blurDataURL}
          alt=""
          className={cn(
            'absolute inset-0 w-full h-full object-cover filter blur-sm scale-110',
            'transition-opacity duration-300',
            isLoaded ? 'opacity-0' : 'opacity-100'
          )}
          aria-hidden="true"
        />
      )}

      {/* Imagem principal */}
      {isInView && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0',
            hasError && errorClassName,
            className
          )}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}

      {/* Estado de erro */}
      {hasError && (
        <div className={cn(
          'absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900',
          errorClassName
        )}>
          <div className="text-center text-gray-400">
            <svg
              className="w-8 h-8 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <span className="text-xs">Falha ao carregar imagem</span>
          </div>
        </div>
      )}
    </div>
  );
}