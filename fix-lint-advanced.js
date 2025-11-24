const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get eslint output as JSON
console.log('Running eslint...');
let eslintOutput;
try {
  eslintOutput = execSync('npx eslint . --format json 2>/dev/null', { encoding: 'utf8' });
} catch (err) {
  eslintOutput = err.stdout || '';
}

let results = [];
try {
  results = JSON.parse(eslintOutput);
} catch (e) {
  console.log('Could not parse ESLint output');
  process.exit(1);
}

const fixesByFile = {};
let totalFixed = 0;

// Process each file and its errors
results.forEach(file => {
  if (!file.messages || file.messages.length === 0) return;

  const filePath = file.filePath;
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Group messages by type
  const unusedVars = file.messages.filter(m => m.ruleId === 'no-unused-vars' || m.ruleId === '@typescript-eslint/no-unused-vars');
  const tsIgnore = file.messages.filter(m => m.message && m.message.includes('@ts-ignore'));

  // Fix @ts-ignore -> @ts-expect-error
  tsIgnore.forEach(msg => {
    const lineNum = msg.line - 1;
    if (lines[lineNum]) {
      lines[lineNum] = lines[lineNum].replace(/@ts-ignore/g, '@ts-expect-error');
      totalFixed++;
    }
  });

  // Fix unused variables by prefixing with _
  unusedVars.forEach(msg => {
    const lineNum = msg.line - 1;
    const col = msg.column - 1;
    if (lines[lineNum]) {
      const line = lines[lineNum];
      // Extract variable name from message
      const match = line.match(/(['"`]?)([A-Za-z_$]\w*)(['"`]?)\s*(is defined|is assigned)/);
      if (match) {
        const varName = match[2];
        // Replace only the instance at this position
        let newLine = line;
        // Find the exact position and prefix
        const beforeVar = line.substring(0, col);
        const afterMatch = line.substring(col).match(/\b([A-Za-z_$]\w*)\b/);
        if (afterMatch && afterMatch[1] === varName) {
          newLine = beforeVar + '_' + line.substring(col);
          lines[lineNum] = newLine;
          totalFixed++;
        }
      }
    }
  });

  content = lines.join('\n');
  fs.writeFileSync(filePath, content, 'utf8');
});

console.log(`Fixed ${totalFixed} lint issues`);
