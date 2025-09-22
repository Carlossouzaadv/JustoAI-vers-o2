// ================================================================
// SCRIPT DE OTIMIZAÇÃO DE IMAGENS - JUSTOAI V2
// ================================================================
// Comprime e converte imagens para formatos modernos (WebP)

const imagemin = require('imagemin');
const imageminWebp = require('imagemin-webp');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');
const fs = require('fs');
const path = require('path');

async function optimizeImages() {
  console.log('🖼️  Iniciando otimização de imagens...');

  const publicDir = path.join(__dirname, '../public');
  const outputDir = path.join(__dirname, '../public/optimized');

  // Criar diretório de saída se não existir
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Otimizar PNGs e converter para WebP
    console.log('📸 Processando arquivos PNG...');
    const pngFiles = await imagemin([`${publicDir}/*.png`], {
      destination: outputDir,
      plugins: [
        imageminPngquant({
          quality: [0.6, 0.8], // Qualidade entre 60-80%
          speed: 4
        }),
        imageminWebp({
          quality: 85,
          method: 6 // Melhor compressão
        })
      ]
    });

    // Otimizar JPGs e converter para WebP
    console.log('📸 Processando arquivos JPG/JPEG...');
    const jpgFiles = await imagemin([`${publicDir}/*.{jpg,jpeg}`], {
      destination: outputDir,
      plugins: [
        imageminMozjpeg({
          quality: 80,
          progressive: true
        }),
        imageminWebp({
          quality: 85,
          method: 6
        })
      ]
    });

    // Relatório de otimização
    const totalFiles = pngFiles.length + jpgFiles.length;
    const originalSize = calculateTotalSize([...pngFiles, ...jpgFiles]);

    console.log('✅ Otimização concluída!');
    console.log(`📊 Arquivos processados: ${totalFiles}`);
    console.log(`💾 Tamanho original: ${formatBytes(originalSize)}`);
    console.log(`🎯 Arquivos otimizados salvos em: ${outputDir}`);

    // Gerar script de cópia para substituir originais
    generateCopyScript(outputDir, publicDir);

  } catch (error) {
    console.error('❌ Erro durante a otimização:', error);
    process.exit(1);
  }
}

function calculateTotalSize(files) {
  return files.reduce((total, file) => {
    try {
      const stats = fs.statSync(file.sourcePath);
      return total + stats.size;
    } catch (error) {
      return total;
    }
  }, 0);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateCopyScript(optimizedDir, publicDir) {
  const copyScript = `
#!/bin/bash
# Script para copiar imagens otimizadas
echo "🔄 Copiando imagens otimizadas..."

# Backup das originais
mkdir -p ${publicDir}/backup
cp ${publicDir}/*.{png,jpg,jpeg} ${publicDir}/backup/ 2>/dev/null || true

# Copiar otimizadas
cp ${optimizedDir}/* ${publicDir}/

echo "✅ Imagens otimizadas copiadas com sucesso!"
echo "📁 Backup das originais em: ${publicDir}/backup"
`;

  fs.writeFileSync(path.join(__dirname, 'copy-optimized.sh'), copyScript);
  console.log('📝 Script de cópia gerado: scripts/copy-optimized.sh');
}

// Executar otimização
optimizeImages().catch(console.error);
