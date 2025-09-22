// ================================================================
// COMPONENTE DE IMAGEM OTIMIZADA - Gerado automaticamente
// ================================================================

import Image from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

export default function OptimizedImage({
  src,
  alt,
  width = 800,
  height = 600,
  className = '',
  priority = false
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);

  // Gerar sources para diferentes formatos
  const baseName = src.replace(/\.[^/.]+$/, "");

  return (
    <picture className={className}>
      {/* AVIF - Formato mais moderno */}
      <source
        srcSet={`/optimized/${baseName}.avif`}
        type="image/avif"
      />

      {/* WebP - Amplamente suportado */}
      <source
        srcSet={`/optimized/${baseName}.webp`}
        type="image/webp"
      />

      {/* Fallback para navegadores antigos */}
      <Image
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={`transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          console.warn(`Erro carregando imagem otimizada: ${src}`);
          setImageSrc(src); // Fallback para original
        }}
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
      />

      {isLoading && (
        <div
          className="absolute inset-0 bg-gray-200 animate-pulse rounded"
          style={{ width, height }}
        />
      )}
    </picture>
  );
}

// Lista de imagens otimizadas disponíveis
export const optimizedImages = [
  "founder-photo",
  "Justo_logo",
  "logo+nome"
];
