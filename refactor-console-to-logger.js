#!/usr/bin/env node
/**
 * Automated refactoring script to convert console.log/warn/error to Pino logger
 * Usage: node refactor-console-to-logger.js <file-paths...>
 */

const fs = require('fs');
const path = require('path');

// Track results
const results = [];

function hasLoggerImport(content) {
  return content.includes("from '@/lib/services/logger'") ||
         content.includes('from "@/lib/services/logger"');
}

function addLoggerImport(content) {
  if (hasLoggerImport(content)) {
    return content;
  }

  // Find last import line
  const lines = content.split('\n');
  let lastImportIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ') && line.includes('from')) {
      lastImportIdx = i;
    }
  }

  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, "import { log, logError } from '@/lib/services/logger';");
    return lines.join('\n');
  }

  // Add at the beginning if no imports
  return "import { log, logError } from '@/lib/services/logger';\n\n" + content;
}

function refactorFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Count console statements before
    const consoleMatches = content.match(/console\.(log|warn|error)/g);
    const countBefore = consoleMatches ? consoleMatches.length : 0;

    if (countBefore === 0) {
      return { success: true, count: 0, filePath };
    }

    console.log(`\nProcessing: ${path.basename(filePath)} (${countBefore} console statements)`);

    // Add import
    content = addLoggerImport(content);

    // Replace console.error patterns
    // Pattern: console.error(`...: `, error) or console.error('...', error)
    content = content.replace(
      /console\.error\(\s*[`'"]([^`'"]+)[`'"]\s*,\s*(\w+)\s*\)/g,
      (match, msg, errorVar) => {
        const cleanMsg = msg.replace(/[\[\]]/g, '').trim();
        return `logError(${errorVar}, "${cleanMsg}", { component: "refactored" })`;
      }
    );

    // Pattern: console.error(`...`)
    content = content.replace(
      /console\.error\(\s*`([^`]+)`\s*\)/g,
      (match, msg) => {
        // Remove template interpolations for simple message
        const cleanMsg = msg.replace(/\$\{[^}]+\}/g, '').trim();
        return `log.error({ msg: "${cleanMsg}" })`;
      }
    );

    // Pattern: console.error('simple message')
    content = content.replace(
      /console\.error\(\s*['"]([^'"]+)['"]\s*\)/g,
      'log.error({ msg: "$1" })'
    );

    // Replace console.warn patterns
    // Pattern: console.warn(`...: `, error) or console.warn('...', error)
    content = content.replace(
      /console\.warn\(\s*[`'"]([^`'"]+)[`'"]\s*,\s*(\w+)\s*\)/g,
      (match, msg, errorVar) => {
        const cleanMsg = msg.replace(/[\[\]]/g, '').trim();
        return `logError(${errorVar}, "${cleanMsg}", { component: "refactored" })`;
      }
    );

    // Pattern: console.warn(`...`)
    content = content.replace(
      /console\.warn\(\s*`([^`]+)`\s*\)/g,
      (match, msg) => {
        const cleanMsg = msg.replace(/\$\{[^}]+\}/g, '').trim();
        return `log.warn({ msg: "${cleanMsg}" })`;
      }
    );

    // Pattern: console.warn('simple message')
    content = content.replace(
      /console\.warn\(\s*['"]([^'"]+)['"]\s*\)/g,
      'log.warn({ msg: "$1" })'
    );

    // Replace console.log patterns
    // Pattern: console.log(`...`)
    content = content.replace(
      /console\.log\(\s*`([^`]+)`\s*\)/g,
      (match, msg) => {
        const cleanMsg = msg.replace(/\$\{[^}]+\}/g, '').trim();
        return `log.info({ msg: "${cleanMsg}" })`;
      }
    );

    // Pattern: console.log('simple message')
    content = content.replace(
      /console\.log\(\s*['"]([^'"]+)['"]\s*\)/g,
      'log.info({ msg: "$1" })'
    );

    // Count remaining console statements
    const remainingMatches = content.match(/console\.(log|warn|error)/g);
    const countAfter = remainingMatches ? remainingMatches.length : 0;
    const converted = countBefore - countAfter;

    // Write back if changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Converted ${converted} statements (${countAfter} remaining)`);
      return { success: true, count: converted, remaining: countAfter, filePath };
    }

    return { success: true, count: 0, filePath };

  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return { success: false, count: 0, filePath, error: error.message };
  }
}

// Main execution
if (process.argv.length < 3) {
  console.log('Usage: node refactor-console-to-logger.js <file-paths...>');
  process.exit(1);
}

const filePaths = process.argv.slice(2);

console.log(`\nRefactoring ${filePaths.length} files...`);
console.log('='.repeat(50));

for (const filePath of filePaths) {
  const result = refactorFile(filePath);
  results.push(result);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('SUMMARY:');
console.log('='.repeat(50));

const successful = results.filter(r => r.success);
const failed = results.filter(r => !r.success);
const totalConverted = successful.reduce((sum, r) => sum + r.count, 0);
const totalRemaining = successful.reduce((sum, r) => sum + (r.remaining || 0), 0);

for (const result of successful.filter(r => r.count > 0)) {
  console.log(`✓ ${path.basename(result.filePath)}: ${result.count} converted`);
}

if (failed.length > 0) {
  console.log('\nFailed:');
  for (const result of failed) {
    console.log(`✗ ${path.basename(result.filePath)}: ${result.error}`);
  }
}

console.log(`\nTotal files processed: ${filePaths.length}`);
console.log(`Successful: ${successful.length}`);
console.log(`Failed: ${failed.length}`);
console.log(`Total statements converted: ${totalConverted}`);
console.log(`Total statements remaining: ${totalRemaining}`);
