#!/usr/bin/env node

/**
 * Fix syntax errors caused by automated logger replacement
 * Handles cases where template literals were incorrectly converted
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/app/api/documents/upload/route.ts',
  'src/app/api/process/upload/route.ts',
  'src/app/api/webhook/judit/callback/route.ts',
  'src/app/api/webhooks/judit/tracking/route.ts',
  'src/lib/payment-webhook-handler.ts',
];

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // Fix 1: Handle log.info with ternary operator that was split
    // Pattern: log.info({ msg: "var ? `template` : `template`", ...
    // Should be: log.info({ msg: var ? `template` : `template`, ...
    content = content.replace(
      /log\.info\(\{\s*msg:\s*"([^"]+)\s*\?\s*`([^`]+)`\s*:\s*`([^`]+)`([^}]*)"\s*,/g,
      (match, varName, trueVal, falseVal, rest) => {
        return `log.info({ msg: ${varName} ? \`${trueVal}\` : \`${falseVal}\`,${rest}`;
      }
    );

    // Fix 2: Handle log.info with context object that was merged
    // Pattern: log.info({ msg: "...", component: "" });, { field: value, ...
    // Should be: log.info({ msg: "...", component: "", field: value, ...
    content = content.replace(
      /log\.info\(\{\s*msg:\s*"([^"]+)",\s*component:\s*""\s*\}\);\s*,\s*\{([^}]+)\}\);/g,
      (match, msg, contextFields) => {
        return `log.info({ msg: "${msg}", component: "", ${contextFields} });`;
      }
    );

    // Fix 3: Multiple log.info calls that got corrupted
    // Specifically for webhook tracking where backticks broke the string
    content = content.replace(
      /log\.info\(\{\s*msg:\s*"\$\{ICONS\.([^}]+)\}\s*([^"]+)`(?:,\s*\{([^}]*)\})?",\s*component:/g,
      (match, icon, msg, context) => {
        if (context) {
          return `log.info({ msg: "${msg}", component:`;
        }
        return match;
      }
    );

    // Fix 4: Handle broken template literals in log calls
    // Pattern: log.info({ msg: "${ICONS...}` + `...
    content = content.replace(
      /log\.info\(\{\s*msg:\s*"\$\{ICONS\.([^}]+)\}([^`]*)`\s*\+\s*`([^`]*)`([^}]*)",\s*component:/g,
      (match, icon, start, end, rest) => {
        const fullMsg = start + end;
        return `log.info({ msg: "${fullMsg}", component:`;
      }
    );

    // Fix 5: Restore proper error logging with context
    // Pattern: log.error({ msg: "...", component: "..." });)
    content = content.replace(
      /log\.error\(\{\s*msg:\s*"([^"]+)",\s*component:\s*"([^"]*)"\s*\}\);\)/g,
      (match, msg, component) => {
        return `log.error(error, "${msg}", { component: "${component}" });`;
      }
    );

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🔧 Fixing logger syntax errors...\n');

  let fixedCount = 0;

  for (const filePath of filesToFix) {
    if (fixFile(filePath)) {
      fixedCount++;
      console.log(`✅ Fixed: ${filePath}`);
    } else {
      console.log(`⏭️  ${filePath} (already correct or no fixes needed)`);
    }
  }

  console.log(`\n✨ Done! Fixed ${fixedCount}/${filesToFix.length} files`);
}

main();
