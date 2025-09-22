// ================================================================
// SCRIPT DE ANÁLISE DE PERFORMANCE - JUSTOAI V2
// ================================================================
// Analisa e reporta métricas de performance do site

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function analyzePerformance() {
  console.log('🔍 Iniciando análise de performance...');

  const results = {
    images: await analyzeImages(),
    bundles: await analyzeBundles(),
    cache: analyzeCacheStrategy(),
    recommendations: []
  };

  // Gerar relatório
  generateReport(results);
}

async function analyzeImages() {
  console.log('📸 Analisando otimização de imagens...');

  const publicDir = path.join(__dirname, '../public');
  const optimizedDir = path.join(publicDir, 'optimized');

  const originalImages = fs.existsSync(publicDir)
    ? fs.readdirSync(publicDir).filter(file => /\.(png|jpe?g|gif)$/i.test(file))
    : [];

  const optimizedImages = fs.existsSync(optimizedDir)
    ? fs.readdirSync(optimizedDir).filter(file => /\.(png|jpe?g|gif|webp|avif)$/i.test(file))
    : [];

  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;

  // Calcular tamanhos
  originalImages.forEach(file => {
    try {
      const filePath = path.join(publicDir, file);
      const stats = fs.statSync(filePath);
      totalOriginalSize += stats.size;
    } catch (error) {
      // Ignorar erros de arquivo
    }
  });

  optimizedImages.forEach(file => {
    try {
      const filePath = path.join(optimizedDir, file);
      const stats = fs.statSync(filePath);
      totalOptimizedSize += stats.size;
    } catch (error) {
      // Ignorar erros de arquivo
    }
  });

  const savings = totalOriginalSize > 0
    ? ((totalOriginalSize - totalOptimizedSize) / totalOriginalSize * 100).toFixed(1)
    : 0;

  return {
    originalCount: originalImages.length,
    optimizedCount: optimizedImages.length,
    originalSize: totalOriginalSize,
    optimizedSize: totalOptimizedSize,
    savings: parseFloat(savings),
    webpAvailable: optimizedImages.some(file => file.endsWith('.webp')),
    avifAvailable: optimizedImages.some(file => file.endsWith('.avif'))
  };
}

async function analyzeBundles() {
  console.log('📦 Analisando bundles JavaScript...');

  const buildDir = path.join(__dirname, '../.next/static/chunks');

  if (!fs.existsSync(buildDir)) {
    return {
      analyzed: false,
      message: 'Build não encontrado. Execute npm run build primeiro.'
    };
  }

  const chunks = fs.readdirSync(buildDir)
    .filter(file => file.endsWith('.js'))
    .map(file => {
      const filePath = path.join(buildDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        gzipEstimate: Math.round(stats.size * 0.3) // Estimativa de compressão gzip
      };
    })
    .sort((a, b) => b.size - a.size);

  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
  const totalGzipEstimate = chunks.reduce((sum, chunk) => sum + chunk.gzipEstimate, 0);

  return {
    analyzed: true,
    totalChunks: chunks.length,
    totalSize,
    totalGzipEstimate,
    largestChunks: chunks.slice(0, 5),
    compressionRatio: ((totalSize - totalGzipEstimate) / totalSize * 100).toFixed(1)
  };
}

function analyzeCacheStrategy() {
  console.log('🗄️  Analisando estratégia de cache...');

  const nextConfigPath = path.join(__dirname, '../next.config.ts');
  const middlewarePath = path.join(__dirname, '../src/middleware.ts');

  const hasNextConfig = fs.existsSync(nextConfigPath);
  const hasMiddleware = fs.existsSync(middlewarePath);

  let cacheHeaders = [];
  let cacheRules = [];

  if (hasNextConfig) {
    try {
      const configContent = fs.readFileSync(nextConfigPath, 'utf8');
      if (configContent.includes('Cache-Control')) {
        cacheHeaders.push('Headers de cache configurados no Next.js');
      }
      if (configContent.includes('immutable')) {
        cacheRules.push('Cache imutável para assets estáticos');
      }
    } catch (error) {
      // Ignorar erros de leitura
    }
  }

  if (hasMiddleware) {
    try {
      const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
      if (middlewareContent.includes('Cache-Control')) {
        cacheHeaders.push('Middleware de cache implementado');
      }
      if (middlewareContent.includes('stale-while-revalidate')) {
        cacheRules.push('Cache com revalidação em background');
      }
    } catch (error) {
      // Ignorar erros de leitura
    }
  }

  return {
    hasConfiguration: hasNextConfig || hasMiddleware,
    cacheHeaders: cacheHeaders.length,
    cacheRules: cacheRules.length,
    strategies: [...cacheHeaders, ...cacheRules]
  };
}

function generateReport(results) {
  console.log('\n📊 RELATÓRIO DE PERFORMANCE\n');
  console.log('================================');

  // Relatório de Imagens
  console.log('\n🖼️  OTIMIZAÇÃO DE IMAGENS');
  console.log(`• Imagens originais: ${results.images.originalCount}`);
  console.log(`• Imagens otimizadas: ${results.images.optimizedCount}`);
  console.log(`• Economia de espaço: ${results.images.savings}%`);
  console.log(`• Formato WebP disponível: ${results.images.webpAvailable ? '✅' : '❌'}`);
  console.log(`• Formato AVIF disponível: ${results.images.avifAvailable ? '✅' : '❌'}`);

  if (results.images.originalSize > 0) {
    console.log(`• Tamanho original: ${formatBytes(results.images.originalSize)}`);
    console.log(`• Tamanho otimizado: ${formatBytes(results.images.optimizedSize)}`);
  }

  // Relatório de Bundles
  console.log('\n📦 ANÁLISE DE BUNDLES');
  if (results.bundles.analyzed) {
    console.log(`• Total de chunks: ${results.bundles.totalChunks}`);
    console.log(`• Tamanho total: ${formatBytes(results.bundles.totalSize)}`);
    console.log(`• Estimativa com gzip: ${formatBytes(results.bundles.totalGzipEstimate)}`);
    console.log(`• Compressão estimada: ${results.bundles.compressionRatio}%`);

    console.log('\n📋 Maiores chunks:');
    results.bundles.largestChunks.forEach((chunk, index) => {
      console.log(`  ${index + 1}. ${chunk.name}: ${formatBytes(chunk.size)}`);
    });
  } else {
    console.log(`• ${results.bundles.message}`);
  }

  // Relatório de Cache
  console.log('\n🗄️  ESTRATÉGIA DE CACHE');
  console.log(`• Configuração presente: ${results.cache.hasConfiguration ? '✅' : '❌'}`);
  console.log(`• Headers de cache: ${results.cache.cacheHeaders}`);
  console.log(`• Regras de cache: ${results.cache.cacheRules}`);

  if (results.cache.strategies.length > 0) {
    console.log('\n📋 Estratégias implementadas:');
    results.cache.strategies.forEach(strategy => {
      console.log(`  • ${strategy}`);
    });
  }

  // Recomendações
  console.log('\n💡 RECOMENDAÇÕES');

  if (results.images.savings < 50) {
    console.log('  ⚠️  Considere otimizar mais as imagens (< 50% economia)');
  }

  if (!results.images.webpAvailable) {
    console.log('  ⚠️  Implemente formato WebP para melhor compressão');
  }

  if (!results.cache.hasConfiguration) {
    console.log('  ⚠️  Configure estratégias de cache para melhor performance');
  }

  if (results.bundles.analyzed && results.bundles.totalSize > 500000) {
    console.log('  ⚠️  Bundles grandes detectados - considere code splitting');
  }

  // Score geral
  let score = 0;
  if (results.images.savings > 70) score += 25;
  else if (results.images.savings > 50) score += 15;
  else if (results.images.savings > 30) score += 10;

  if (results.images.webpAvailable) score += 15;
  if (results.images.avifAvailable) score += 10;
  if (results.cache.hasConfiguration) score += 25;
  if (results.bundles.analyzed && results.bundles.compressionRatio > 60) score += 15;

  console.log(`\n🏆 SCORE DE PERFORMANCE: ${score}/100`);

  if (score >= 80) console.log('   🎉 Excelente! Site bem otimizado');
  else if (score >= 60) console.log('   👍 Bom! Algumas otimizações podem ser feitas');
  else if (score >= 40) console.log('   ⚠️  Regular. Várias otimizações necessárias');
  else console.log('   🚨 Crítico! Otimizações urgentes necessárias');

  console.log('\n================================\n');

  // Salvar relatório em arquivo
  const reportData = {
    timestamp: new Date().toISOString(),
    score,
    results,
    recommendations: results.recommendations
  };

  const reportPath = path.join(__dirname, '../performance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`📄 Relatório salvo em: ${reportPath}`);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Executar análise
analyzePerformance().catch(console.error);