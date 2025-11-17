#!/usr/bin/env node

/**
 * Script to replace all console.log/warn/error with structured logger calls
 * Usage: node scripts/replace-console-with-logger.js
 */

const fs = require('fs');
const path = require('path');

const LOGGER_IMPORT = "import { log, logError } from '@/lib/services/logger';";

const priorityFiles = [
  'src/lib/deep-analysis-service.ts',
  'src/lib/webhook-signature-verifiers.ts',
  'src/lib/ai-model-router.ts',
  'src/lib/analysis-cache.ts',
  'src/lib/alerts/ops-alerts.ts',
  'src/lib/credit-system.ts',
  'src/lib/timeline-merge.ts',
  'src/lib/report-generator.ts',
  'src/lib/payment-webhook-handler.ts',
  'src/app/api/webhooks/judit/tracking/route.ts',
  'src/app/api/process/upload/route.ts',
  'src/app/api/webhook/judit/callback/route.ts',
  'src/app/api/documents/upload/route.ts',
];

function getComponentName(filePath) {
  const filename = path.basename(filePath, '.ts');
  return filename
    .replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase())
    .replace(/route$/, '');
}

function extractStringContent(str) {
  // Remove template literal markers and excessive whitespace
  let content = str
    .replace(/^`|`$/g, '') // Remove backticks
    .replace(/^["']|["']$/g, '') // Remove quotes
    .trim();

  // Limit to reasonable length
  if (content.length > 150) {
    content = content.substring(0, 147) + '...';
  }

  return content;
}

function replaceConsoleStatements(content, filePath) {
  const component = getComponentName(filePath);
  let modified = false;
  let replacementCount = 0;

  // Replace console.error with logError (must be first to avoid conflicts)
  // Pattern: console.error(... [optional: error], ...rest)
  content = content.replace(
    /console\.error\s*\(\s*([^,)]+(?:\s*,\s*[^,)]+)*)\s*\);?/g,
    (match, args) => {
      modified = true;
      replacementCount++;

      // Try to identify if first arg is likely an error
      const argsTrimmed = args.trim();
      const isError = argsTrimmed.includes('error') || argsTrimmed.includes('Error') || argsTrimmed.includes('err');

      if (isError) {
        // Extract first error and message
        const parts = args.split(',').map(s => s.trim());
        const errorVar = parts[0];
        const msg = extractStringContent(parts.slice(1).join(',') || 'Error occurred');
        return `logError(${errorVar}, "${msg}", { component: "${component}" });`;
      } else {
        // No error object, just message
        const msg = extractStringContent(argsTrimmed);
        return `log.error({ msg: "${msg}", component: "${component}" });`;
      }
    }
  );

  // Replace console.warn
  content = content.replace(
    /console\.warn\s*\(\s*(`[^`]*`|"[^"]*"|'[^']*'|[^)]+)\s*\);?/g,
    (match, arg) => {
      modified = true;
      replacementCount++;
      const msg = extractStringContent(arg);
      return `log.warn({ msg: "${msg}", component: "${component}" });`;
    }
  );

  // Replace console.log
  content = content.replace(
    /console\.log\s*\(\s*(`[^`]*`|"[^"]*"|'[^']*'|[^)]+)\s*\);?/g,
    (match, arg) => {
      modified = true;
      replacementCount++;
      const msg = extractStringContent(arg);
      return `log.info({ msg: "${msg}", component: "${component}" });`;
    }
  );

  return { content, modified, replacementCount };
}

function addLoggerImportIfNeeded(content, filePath) {
  // Check if file already has logger import
  if (content.includes("from '@/lib/services/logger'")) {
    return content; // Already has it
  }

  // Find the last import statement
  const importRegex = /^import\s+[^;]+;/gm;
  const imports = [];
  let lastImportEnd = 0;

  let match;
  const importRegexCopy = /^import\s+[^;]+;/gm;
  while ((match = importRegexCopy.exec(content)) !== null) {
    imports.push(match);
    lastImportEnd = match.index + match[0].length;
  }

  if (lastImportEnd > 0) {
    // Insert after last import
    content = content.slice(0, lastImportEnd) + '\n' + LOGGER_IMPORT + content.slice(lastImportEnd);
  } else {
    // No imports found, add at top
    content = LOGGER_IMPORT + '\n' + content;
  }

  return content;
}

function processFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // Replace console statements
    const { content: replaced, modified, replacementCount } = replaceConsoleStatements(content, filePath);

    if (modified) {
      content = replaced;
      // Add logger import if replacements were made
      content = addLoggerImportIfNeeded(content, filePath);

      // Only write if content actually changed
      if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        return { success: true, replacementCount, modified: true };
      }
    }

    return { success: true, replacementCount: 0, modified: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function main() {
  console.log('🔄 Starting console → logger replacement...\n');

  let totalReplaced = 0;
  let totalFiles = 0;
  let successCount = 0;
  const results = [];

  for (const filePath of priorityFiles) {
    totalFiles++;
    const result = processFile(filePath);

    if (result.success) {
      successCount++;
      results.push({
        file: filePath,
        replaced: result.replacementCount,
        modified: result.modified,
      });

      if (result.modified) {
        totalReplaced += result.replacementCount;
        console.log(`✅ ${filePath}`);
        console.log(`   → Replaced ${result.replacementCount} console statements`);
      } else {
        console.log(`⏭️  ${filePath} (no changes needed)`);
      }
    } else {
      console.log(`❌ ${filePath}`);
      console.log(`   → Error: ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Files processed: ${successCount}/${totalFiles}`);
  console.log(`🔄 Total console statements replaced: ${totalReplaced}`);
  console.log('\n📋 Details:');

  results.forEach(r => {
    if (r.modified) {
      console.log(`  • ${r.file}: ${r.replaced} replacements`);
    }
  });

  console.log('\n✨ Done! Remember to:');
  console.log('  1. Review the changes: git diff');
  console.log('  2. Test locally: npm run dev');
  console.log('  3. Type check: npm run type-check');
  console.log('  4. Commit: git add -A && git commit -m "refactor(logging): replace console with structured logger"');
}

main();
