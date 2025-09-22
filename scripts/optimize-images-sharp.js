// ================================================================
// SCRIPT DE OTIMIZAÇÃO DE IMAGENS - JUSTOAI V2 (Sharp)
// ================================================================
// Comprime e converte imagens usando Sharp (mais confiável)

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function optimizeImages() {
  console.log('🖼️  Iniciando otimização de imagens com Sharp...');

  const publicDir = path.join(__dirname, '../public');
  const outputDir = path.join(__dirname, '../public/optimized');

  // Criar diretório de saída se não existir
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Encontrar todas as imagens
    const imageFiles = fs.readdirSync(publicDir)
      .filter(file => /\.(png|jpe?g|gif)$/i.test(file))
      .map(file => path.join(publicDir, file));

    console.log(`📸 Encontradas ${imageFiles.length} imagens para otimizar`);

    let totalOriginalSize = 0;
    let totalOptimizedSize = 0;

    for (const imagePath of imageFiles) {
      const fileName = path.basename(imagePath, path.extname(imagePath));
      const ext = path.extname(imagePath).toLowerCase();

      try {
        // Calcular tamanho original
        const originalStats = fs.statSync(imagePath);
        totalOriginalSize += originalStats.size;

        console.log(`📷 Processando: ${path.basename(imagePath)}`);

        // Otimizar imagem original
        const optimizedPath = path.join(outputDir, path.basename(imagePath));

        if (ext === '.png') {
          await sharp(imagePath)
            .png({
              quality: 80,
              compressionLevel: 9,
              adaptiveFiltering: true
            })
            .toFile(optimizedPath);
        } else if (ext === '.jpg' || ext === '.jpeg') {
          await sharp(imagePath)
            .jpeg({
              quality: 80,
              progressive: true,
              mozjpeg: true
            })
            .toFile(optimizedPath);
        } else if (ext === '.gif') {
          // Para GIFs, apenas copiar (Sharp não otimiza GIFs animados muito bem)
          fs.copyFileSync(imagePath, optimizedPath);
        }

        // Criar versão WebP
        const webpPath = path.join(outputDir, `${fileName}.webp`);
        await sharp(imagePath)
          .webp({
            quality: 85,
            method: 6,
            effort: 6
          })
          .toFile(webpPath);

        // Criar versão AVIF (ainda mais moderna)
        const avifPath = path.join(outputDir, `${fileName}.avif`);
        try {
          await sharp(imagePath)
            .avif({
              quality: 80,
              effort: 6
            })
            .toFile(avifPath);
        } catch (error) {
          console.log(`⚠️  AVIF não suportado para ${fileName}, pulando...`);
        }

        // Calcular tamanho otimizado
        const optimizedStats = fs.statSync(optimizedPath);
        const webpStats = fs.statSync(webpPath);
        totalOptimizedSize += optimizedStats.size + webpStats.size;

        const savings = ((originalStats.size - optimizedStats.size) / originalStats.size * 100).toFixed(1);
        console.log(`   ✅ ${path.basename(imagePath)}: ${formatBytes(originalStats.size)} → ${formatBytes(optimizedStats.size)} (${savings}% economia)`);

      } catch (error) {
        console.error(`❌ Erro processando ${path.basename(imagePath)}:`, error.message);
      }
    }

    // Relatório final
    const totalSavings = ((totalOriginalSize - totalOptimizedSize) / totalOriginalSize * 100).toFixed(1);

    console.log('\n🎉 Otimização concluída!');
    console.log(`📊 Arquivos processados: ${imageFiles.length}`);
    console.log(`💾 Tamanho original total: ${formatBytes(totalOriginalSize)}`);
    console.log(`🎯 Tamanho otimizado total: ${formatBytes(totalOptimizedSize)}`);
    console.log(`💡 Economia total: ${totalSavings}%`);
    console.log(`📁 Arquivos otimizados em: ${outputDir}`);

    // Gerar componente React para imagens responsivas
    generateImageComponent(outputDir);

  } catch (error) {
    console.error('❌ Erro durante a otimização:', error);
    process.exit(1);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateImageComponent(outputDir) {
  const optimizedImages = fs.readdirSync(outputDir)
    .filter(file => !file.includes('.webp') && !file.includes('.avif'))
    .map(file => path.basename(file, path.extname(file)));

  const componentCode = `// ================================================================
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
  const baseName = src.replace(/\\.[^/.]+$/, "");

  return (
    <picture className={className}>
      {/* AVIF - Formato mais moderno */}
      <source
        srcSet={\`/optimized/\${baseName}.avif\`}
        type="image/avif"
      />

      {/* WebP - Amplamente suportado */}
      <source
        srcSet={\`/optimized/\${baseName}.webp\`}
        type="image/webp"
      />

      {/* Fallback para navegadores antigos */}
      <Image
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={\`transition-opacity duration-300 \${isLoading ? 'opacity-0' : 'opacity-100'}\`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          console.warn(\`Erro carregando imagem otimizada: \${src}\`);
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
export const optimizedImages = ${JSON.stringify(optimizedImages, null, 2)};
`;

  const componentPath = path.join(__dirname, '../src/components/OptimizedImage.tsx');
  fs.writeFileSync(componentPath, componentCode);
  console.log('📝 Componente React gerado: src/components/OptimizedImage.tsx');
}

// Executar otimização
optimizeImages().catch(console.error);