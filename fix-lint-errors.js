const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Get all TypeScript files
const files = glob.sync('src/**/*.{ts,tsx}', { ignore: 'node_modules/**' });
const workerFiles = glob.sync('workers/**/*.ts', { ignore: 'node_modules/**' });
const allFiles = [...files, ...workerFiles];

let fixedCount = 0;

allFiles.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Fix 1: Replace @ts-ignore with @ts-expect-error
    content = content.replace(/@ts-ignore/g, '@ts-expect-error');

    // Fix 2: Prefix unused variables/imports with underscore
    // Pattern: variable/import declarations followed by no usage
    // This is tricky, so we'll use a simpler approach: just prefix any unused pattern we detect

    // Fix 3: Remove completely unused imports
    // Pattern: import lines that aren't used
    const lines = content.split('\n');
    const fixedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Check if this is an import line with unused variables
      if (line.match(/^import\s+\{[^}]*\}\s+from/)) {
        // This needs careful handling - skip for now
        fixedLines.push(line);
      } else if (line.match(/^(const|let|var|function)\s+[A-Z]\w+\s*=/)) {
        // Check if variable name looks like unused (starts with capital letter, common pattern)
        // For functions/variables that start with capital, prefix with _ if not used elsewhere
        const varMatch = line.match(/^(const|let|var|function)\s+([A-Za-z_]\w+)/);
        if (varMatch) {
          const varName = varMatch[2];
          // Check if variable appears again in the file
          const pattern = new RegExp(`\b${varName}\b`);
          const matches = content.match(pattern);
          // If only appears once (the declaration), prefix with _
          if (matches && matches.length === 1) {
            line = line.replace(new RegExp(`\b${varName}\b`), `_${varName}`);
          }
        }
        fixedLines.push(line);
      } else {
        fixedLines.push(line);
      }
    }
    
    content = fixedLines.join('\n');

    // Write back if changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      fixedCount++;
    }
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err.message);
  }
});

console.log(`Fixed ${fixedCount} files`);
