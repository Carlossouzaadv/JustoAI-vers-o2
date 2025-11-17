#!/usr/bin/env node

/**
 * Finish the logger migration for remaining 3 files
 * Simpler, regex-based approach that handles the remaining cases
 */

const fs = require('fs');

const files = [
  { path: 'src/app/api/webhook/judit/callback/route.ts', component: 'juditWebhookCallback' },
  { path: 'src/app/api/webhooks/judit/tracking/route.ts', component: 'juditWebhookTracking' },
  { path: 'src/lib/payment-webhook-handler.ts', component: 'paymentWebhookHandler' },
];

function ensureLoggerImport(content) {
  if (content.includes("from '@/lib/services/logger'")) {
    return content;
  }

  // Find last import and add after it
  const lastImportMatch = content.match(/^import\s+[^\n]+;$/m);
  if (lastImportMatch) {
    const lastImportEnd = content.indexOf(lastImportMatch[0]) + lastImportMatch[0].length;
    return (
      content.substring(0, lastImportEnd) +
      "\nimport { log, logError } from '@/lib/services/logger';" +
      content.substring(lastImportEnd)
    );
  }

  // If no imports found, add at top
  return "import { log, logError } from '@/lib/services/logger';\n\n" + content;
}

function replaceConsoleInFile(filePath, component) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Count original console statements
    const originalCount = (content.match(/console\.(log|warn|error)/g) || []).length;

    // Replace: console.log(...) with template literals
    content = content.replace(/console\.log\((.*)\);?/g, (match, args) => {
      modified = true;
      // Keep the args as-is, they already have the formatted message
      return `log.info({ msg: ${args}, component: "${component}" });`;
    });

    // Replace: console.warn(...) with template literals
    content = content.replace(/console\.warn\((.*)\);?/g, (match, args) => {
      modified = true;
      return `log.warn({ msg: ${args}, component: "${component}" });`;
    });

    // Replace: console.error(error, ...)
    content = content.replace(/console\.error\(([^,]+),\s*(.*)\);?/g, (match, errorVar, rest) => {
      modified = true;
      return `logError(${errorVar}, "", { component: "${component}" });`;
    });

    if (modified) {
      content = ensureLoggerImport(content);
      fs.writeFileSync(filePath, content, 'utf8');
      const finalCount = (content.match(/console\.(log|warn|error)/g) || []).length;
      const replaced = originalCount - finalCount;
      console.log(`✅ ${filePath}: Replaced ${replaced}/${originalCount} statements`);
      return replaced;
    }

    console.log(`⏭️  ${filePath}: No changes needed`);
    return 0;
  } catch (error) {
    console.error(`❌ ${filePath}: ${error.message}`);
    return -1;
  }
}

console.log('🔄 Finishing logger migration for 3 remaining files...\n');

let totalReplaced = 0;
for (const { path, component } of files) {
  const count = replaceConsoleInFile(path, component);
  if (count > 0) totalReplaced += count;
}

console.log(`\n✨ Done! Replaced ${totalReplaced} total console statements`);
