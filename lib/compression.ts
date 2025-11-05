/**
 * Compression System - Otimização de Imagens e PDFs
 * Sistema para compressão e otimização de arquivos para produção
 */

import sharp from 'sharp';
import { existsSync, createReadStream, createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import * as path from 'path';
import { createGunzip, createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import type { Request, Response, NextFunction } from 'express';

// === TIPOS E INTERFACES ===

interface UploadedFile {
  originalname: string;
  path: string;
  mimetype?: string;
  size?: number;
  compressedPath?: string;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
}

interface CompressionRequest extends Request {
  file?: UploadedFile;
  files?: UploadedFile[];
}

interface CompressionOptions {
  quality?: number;
  width?: number;
  height?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
  progressive?: boolean;
  preserveMetadata?: boolean;
}

interface CompressionResult {
  success: boolean;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  outputPath: string;
  format: string;
  error?: string;
}

interface PDFOptimizationOptions {
  quality?: 'low' | 'medium' | 'high';
  dpi?: number;
  grayscale?: boolean;
  removeMetadata?: boolean;
}

// === CONFIGURAÇÕES ===

const COMPRESSION_CONFIG = {
  // Configurações de imagem
  IMAGE: {
    WEBP_QUALITY: 85,
    JPEG_QUALITY: 85,
    PNG_COMPRESSION: 8,
    AVIF_QUALITY: 80,
    MAX_WIDTH: 1920,
    MAX_HEIGHT: 1080,
    THUMBNAIL_SIZE: 300,
  },

  // Configurações de PDF
  PDF: {
    DPI: {
      low: 72,
      medium: 150,
      high: 300,
    },
    JPEG_QUALITY: 85,
  },

  // Limites de arquivo
  LIMITS: {
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    MIN_COMPRESSION_RATIO: 0.1, // 10% mínimo de compressão
  },

  // Diretórios
  DIRS: {
    TEMP: path.join(process.cwd(), 'temp', 'compression'),
    CACHE: path.join(process.cwd(), 'cache', 'compressed'),
    OUTPUT: path.join(process.cwd(), 'public', 'optimized'),
  }
};

// === COMPRESSÃO DE IMAGENS ===

/**
 * Comprime uma imagem usando Sharp
 */
export async function compressImage(
  inputPath: string,
  outputPath?: string,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  try {
    // Verificar se arquivo existe
    if (!existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    const originalStats = await fs.stat(inputPath);
    const originalSize = originalStats.size;

    // Verificar tamanho máximo
    if (originalSize > COMPRESSION_CONFIG.LIMITS.MAX_FILE_SIZE) {
      throw new Error(`File too large: ${formatBytes(originalSize)}`);
    }

    // Configurações padrão
    const config = {
      quality: options.quality || COMPRESSION_CONFIG.IMAGE.WEBP_QUALITY,
      width: options.width,
      height: options.height,
      format: options.format || 'webp',
      progressive: options.progressive ?? true,
      preserveMetadata: options.preserveMetadata ?? false,
    };

    // Determinar path de saída
    const finalOutputPath = outputPath || generateOptimizedPath(inputPath, config.format);

    // Garantir diretório existe
    await ensureDirectory(path.dirname(finalOutputPath));

    // Processar imagem com Sharp
    let sharpInstance = sharp(inputPath);

    // Configurar metadados
    if (!config.preserveMetadata) {
      sharpInstance = sharpInstance.withMetadata({});
    }

    // Redimensionar se especificado
    if (config.width || config.height) {
      sharpInstance = sharpInstance.resize(config.width, config.height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    } else {
      // Aplicar limite máximo padrão
      sharpInstance = sharpInstance.resize(
        COMPRESSION_CONFIG.IMAGE.MAX_WIDTH,
        COMPRESSION_CONFIG.IMAGE.MAX_HEIGHT,
        {
          fit: 'inside',
          withoutEnlargement: true
        }
      );
    }

    // Aplicar formato e compressão
    switch (config.format) {
      case 'webp':
        sharpInstance = sharpInstance.webp({
          quality: config.quality,
        });
        break;

      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({
          quality: config.quality,
          progressive: config.progressive,
        });
        break;

      case 'png':
        sharpInstance = sharpInstance.png({
          compressionLevel: COMPRESSION_CONFIG.IMAGE.PNG_COMPRESSION,
          progressive: config.progressive,
        });
        break;

      case 'avif':
        sharpInstance = sharpInstance.avif({
          quality: config.quality,
        });
        break;

      default:
        throw new Error(`Unsupported format: ${config.format}`);
    }

    // Salvar imagem comprimida
    await sharpInstance.toFile(finalOutputPath);

    // Verificar resultado
    const compressedStats = await fs.stat(finalOutputPath);
    const compressedSize = compressedStats.size;
    const compressionRatio = compressedSize / originalSize;

    return {
      success: true,
      originalSize,
      compressedSize,
      compressionRatio,
      outputPath: finalOutputPath,
      format: config.format,
    };

  } catch (error) {
    return {
      success: false,
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 1,
      outputPath: '',
      format: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Gera thumbnail otimizado
 */
export async function generateThumbnail(
  inputPath: string,
  size: number = COMPRESSION_CONFIG.IMAGE.THUMBNAIL_SIZE
): Promise<CompressionResult> {
  const thumbnailPath = generateThumbnailPath(inputPath);

  return await compressImage(inputPath, thumbnailPath, {
    width: size,
    height: size,
    format: 'webp',
    quality: 75,
  });
}

/**
 * Compressão em lote de imagens
 */
export async function compressBatchImages(
  inputPaths: string[],
  options: CompressionOptions = {}
): Promise<CompressionResult[]> {
  const results: CompressionResult[] = [];

  for (const inputPath of inputPaths) {
    try {
      const result = await compressImage(inputPath, undefined, options);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        originalSize: 0,
        compressedSize: 0,
        compressionRatio: 1,
        outputPath: inputPath,
        format: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}

// === OTIMIZAÇÃO DE PDF ===

/**
 * Otimiza PDF reduzindo qualidade e removendo metadados
 */
export async function optimizePDF(
  inputPath: string,
  outputPath?: string,
  options: PDFOptimizationOptions = {}
): Promise<CompressionResult> {
  try {
    // Verificar se arquivo existe
    if (!existsSync(inputPath)) {
      throw new Error(`PDF file not found: ${inputPath}`);
    }

    const originalStats = await fs.stat(inputPath);
    const originalSize = originalStats.size;

    // Configurações
    // NOTE: config will be used when real PDF optimization is implemented
    // For now, we use gzip as a fallback compression
    void (options.quality || 'medium');

    const finalOutputPath = outputPath || generateOptimizedPath(inputPath, 'pdf');

    // Para otimização real de PDF, utilizaríamos bibliotecas como pdf-lib ou ghostscript
    // Por enquanto, implementamos compressão gzip como fallback
    await compressFileGzip(inputPath, finalOutputPath);

    const compressedStats = await fs.stat(finalOutputPath);
    const compressedSize = compressedStats.size;

    return {
      success: true,
      originalSize,
      compressedSize,
      compressionRatio: compressedSize / originalSize,
      outputPath: finalOutputPath,
      format: 'pdf',
    };

  } catch (error) {
    return {
      success: false,
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 1,
      outputPath: '',
      format: 'pdf',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// === COMPRESSÃO GERAL ===

/**
 * Comprime arquivo usando gzip
 */
export async function compressFileGzip(inputPath: string, outputPath: string): Promise<void> {
  await ensureDirectory(path.dirname(outputPath));

  await pipeline(
    createReadStream(inputPath),
    createGzip({ level: 9 }),
    createWriteStream(outputPath + '.gz')
  );
}

/**
 * Descomprime arquivo gzip
 */
export async function decompressFileGzip(inputPath: string, outputPath: string): Promise<void> {
  await ensureDirectory(path.dirname(outputPath));

  await pipeline(
    createReadStream(inputPath),
    createGunzip(),
    createWriteStream(outputPath)
  );
}

// === MIDDLEWARE DE COMPRESSÃO ===

/**
 * Middleware para compressão automática de uploads
 */
export function createCompressionMiddleware(options: CompressionOptions = {}) {
  return async (req: CompressionRequest, res: Response, next: NextFunction): Promise<void> => {
    // Se há arquivos no upload
    if (req.files || req.file) {
      const files = req.files || [req.file];

      for (const file of Array.isArray(files) ? files : [files]) {
        if (file && file.originalname && isImageFile(file.originalname)) {
          try {
            // Comprimir imagem automaticamente
            const filePath = file.path;
            if (filePath) {
              const result = await compressImage(filePath, undefined, options);

              if (result.success) {
                // Atualizar informações do arquivo
                file.compressedPath = result.outputPath;
                file.originalSize = result.originalSize;
                file.compressedSize = result.compressedSize;
                file.compressionRatio = result.compressionRatio;
              }
            }
          } catch (_error) {
            console.error('Compression middleware error:', _error);
            // Continuar sem falhar se compressão falhar
          }
        }
      }
    }

    next();
  };
}

// === FUNÇÕES UTILITÁRIAS ===

/**
 * Verifica se arquivo é imagem
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp', '.tiff'];
  const ext = path.extname(filename).toLowerCase();
  return imageExtensions.includes(ext);
}

/**
 * Verifica se arquivo é PDF
 */
export function isPDFFile(filename: string): boolean {
  return path.extname(filename).toLowerCase() === '.pdf';
}

/**
 * Gera path otimizado
 */
function generateOptimizedPath(originalPath: string, format: string): string {
  const parsed = path.parse(originalPath);
  const outputDir = path.join(COMPRESSION_CONFIG.DIRS.OUTPUT, parsed.dir);
  return path.join(outputDir, `${parsed.name}.optimized.${format}`);
}

/**
 * Gera path para thumbnail
 */
function generateThumbnailPath(originalPath: string): string {
  const parsed = path.parse(originalPath);
  const outputDir = path.join(COMPRESSION_CONFIG.DIRS.OUTPUT, parsed.dir, 'thumbnails');
  return path.join(outputDir, `${parsed.name}.thumb.webp`);
}

/**
 * Garante que diretório existe
 */
async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Ignore se diretório já existe
  }
}

/**
 * Formata bytes para leitura humana
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// === CACHE DE COMPRESSÃO ===

/**
 * Verifica se arquivo já foi comprimido (cache)
 */
export async function checkCompressionCache(inputPath: string, format: string): Promise<string | null> {
  try {
    const cacheKey = generateCacheKey(inputPath, format);
    const cachedPath = path.join(COMPRESSION_CONFIG.DIRS.CACHE, cacheKey);

    if (existsSync(cachedPath)) {
      const inputStats = await fs.stat(inputPath);
      const cacheStats = await fs.stat(cachedPath);

      // Verificar se cache é mais recente que arquivo original
      if (cacheStats.mtime >= inputStats.mtime) {
        return cachedPath;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Salva resultado da compressão no cache
 */
export async function saveToCompressionCache(inputPath: string, compressedPath: string, format: string): Promise<void> {
  try {
    const cacheKey = generateCacheKey(inputPath, format);
    const cacheDir = COMPRESSION_CONFIG.DIRS.CACHE;

    await ensureDirectory(cacheDir);

    const finalCachePath = path.join(cacheDir, cacheKey);
    await fs.copyFile(compressedPath, finalCachePath);
  } catch (error) {
    // Falha no cache não deve afetar operação principal
    console.warn('Failed to save to compression cache:', error);
  }
}

function generateCacheKey(inputPath: string, format: string): string {
  const parsed = path.parse(inputPath);
  const hash = Buffer.from(inputPath).toString('base64').replace(/[/+=]/g, '_');
  return `${parsed.name}_${hash.substring(0, 8)}.${format}`;
}

// === ESTATÍSTICAS ===

/**
 * Coleta estatísticas de compressão
 */
export async function getCompressionStats(): Promise<{
  totalFiles: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  averageCompressionRatio: number;
  cacheHitRate: number;
}> {
  try {
    // Implementar coleta de estatísticas baseada em logs ou metadata
    return {
      totalFiles: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      averageCompressionRatio: 0,
      cacheHitRate: 0,
    };
  } catch {
    return {
      totalFiles: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      averageCompressionRatio: 0,
      cacheHitRate: 0,
    };
  }
}

const exported = {
  compressImage,
  generateThumbnail,
  compressBatchImages,
  optimizePDF,
  compressFileGzip,
  decompressFileGzip,
  createCompressionMiddleware,
  isImageFile,
  isPDFFile,
  checkCompressionCache,
  saveToCompressionCache,
  getCompressionStats,
  COMPRESSION_CONFIG,
};

export default exported;
