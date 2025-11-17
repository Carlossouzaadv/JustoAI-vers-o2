#!/usr/bin/env node

/**
 * Smart console → logger replacement
 * Handles template literals and multi-line strings properly
 */

const fs = require('fs');
const path = require('path');

const LOGGER_IMPORT = "import { log, logError } from '@/lib/services/logger';";

const filesToProcess = [
  'src/app/api/documents/upload/route.ts',
  'src/app/api/process/upload/route.ts',
  'src/app/api/webhook/judit/callback/route.ts',
  'src/app/api/webhooks/judit/tracking/route.ts',
  'src/lib/payment-webhook-handler.ts',
];

function getComponentName(filePath) {
  const filename = path.basename(filePath, '.ts');
  return filename
    .replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase())
    .replace(/route$/, '')
    .replace(/handler$/, '');
}

function processFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    const component = getComponentName(filePath);
    let replacementCount = 0;

    // Process line by line to handle template literals correctly
    const lines = content.split('\n');
    const result = [];
    let i = 0;

    while (i < lines.length) {
      let line = lines[i];

      // Check for console.error (with potential error object)
      if (line.includes('console.error(')) {
        // Extract the full statement (might span multiple lines)
        let statement = line;
        let bracketCount = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
        let j = i + 1;

        while (bracketCount > 0 && j < lines.length) {
          statement += '\n' + lines[j];
          bracketCount += (lines[j].match(/\(/g) || []).length;
          bracketCount -= (lines[j].match(/\)/g) || []).length;
          j++;
        }

        // Replace with logError - keep context in place
        statement = statement.replace(
          /console\.error\s*\(\s*([^,;]+?)\s*,\s*(.*)\);?$/,
          (match, error, rest) => {
            const msg = 'Error occurred';
            return `logError(${error}, "${msg}", { component: "${component}" });`;
          }
        );

        // If no error object found, just replace as log.error
        if (statement.includes('console.error')) {
          statement = statement.replace(
            /console\.error\s*\(\s*(.+?)\s*\);?$/,
            (match, args) => {
              return `log.error({ msg: ${args}, component: "${component}" });`;
            }
          );
        }

        result.push(statement);
        i = j;
        replacementCount++;
        continue;
      }

      // Check for console.warn
      if (line.includes('console.warn(')) {
        let statement = line;
        let bracketCount = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
        let j = i + 1;

        while (bracketCount > 0 && j < lines.length) {
          statement += '\n' + lines[j];
          bracketCount += (lines[j].match(/\(/g) || []).length;
          bracketCount -= (lines[j].match(/\)/g) || []).length;
          j++;
        }

        statement = statement.replace(
          /console\.warn\s*\(\s*(.+?)\s*\);?$/s,
          (match, args) => {
            return `log.warn({ msg: ${args}, component: "${component}" });`;
          }
        );

        result.push(statement);
        i = j;
        replacementCount++;
        continue;
      }

      // Check for console.log
      if (line.includes('console.log(')) {
        let statement = line;
        let bracketCount = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
        let j = i + 1;

        while (bracketCount > 0 && j < lines.length) {
          statement += '\n' + lines[j];
          bracketCount += (lines[j].match(/\(/g) || []).length;
          bracketCount -= (lines[j].match(/\)/g) || []).length;
          j++;
        }

        statement = statement.replace(
          /console\.log\s*\(\s*(.+?)\s*\);?$/s,
          (match, args) => {
            return `log.info({ msg: ${args}, component: "${component}" });`;
          }
        );

        result.push(statement);
        i = j;
        replacementCount++;
        continue;
      }

      result.push(line);
      i++;
    }

    const newContent = result.join('\n');

    // Add logger import if replacements were made
    let finalContent = newContent;
    if (replacementCount > 0 && !newContent.includes("from '@/lib/services/logger'")) {
      const importRegex = /^import\s+[^;]+;/m;
      const match = newContent.match(importRegex);

      if (match) {
        finalContent = newContent.replace(
          importRegex,
          match[0] + '\n' + LOGGER_IMPORT
        );
      } else {
        finalContent = LOGGER_IMPORT + '\n\n' + newContent;
      }
    }

    if (finalContent !== original) {
      fs.writeFileSync(filePath, finalContent, 'utf8');
      return { success: true, replacementCount, modified: true };
    }

    return { success: true, replacementCount: 0, modified: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function main() {
  console.log('🔄 Smart console → logger replacement (careful with templates)...\n');

  let totalReplaced = 0;
  let totalFiles = 0;
  let successCount = 0;

  for (const filePath of filesToProcess) {
    totalFiles++;
    const result = processFile(filePath);

    if (result.success) {
      successCount++;

      if (result.modified) {
        totalReplaced += result.replacementCount;
        console.log(`✅ ${filePath}`);
        console.log(`   → Replaced ${result.replacementCount} console statements`);
      } else {
        console.log(`⏭️  ${filePath}`);
      }
    } else {
      console.log(`❌ ${filePath}`);
      console.log(`   → Error: ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`✅ Successfully processed ${successCount}/${totalFiles} files`);
  console.log(`🔄 Total statements replaced: ${totalReplaced}`);
}

main();
