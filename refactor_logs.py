#!/usr/bin/env python3
"""
Script para refatorar console.log/error/warn em Pino logger
Estratégia:
1. Encontra console.* statements
2. Detecta padrões (emojis, mensagens)
3. Converte para log.info/error/warn com estrutura
"""

import re
import sys
from pathlib import Path

def refactor_file(filepath: str) -> tuple[int, str]:
    """Refactor a single file. Returns (count_refactored, content)"""

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    count = 0

    # Padrão 1: console.log com ICONS (emojis)
    # console.log(`${ICONS.SUCCESS} Message`)
    pattern1 = r"console\.log\(\`\$\{ICONS\.[A-Z_]+\}\s*([^`]*)\`(?:,\s*([^)]*))?\);"
    def replace1(match):
        nonlocal count
        count += 1
        msg = match.group(1).strip()
        data = match.group(2) or ""
        return f"log.info({{ msg: '{msg}', component: 'todo'{', ' + data if data else ''} }});"

    content = re.sub(pattern1, replace1, content)

    # Padrão 2: console.warn com ICONS
    pattern2 = r"console\.warn\(\`\$\{ICONS\.[A-Z_]+\}\s*([^`]*)\`(?:,\s*([^)]*))?\);"
    def replace2(match):
        nonlocal count
        count += 1
        msg = match.group(1).strip()
        data = match.group(2) or ""
        return f"log.warn({{ msg: '{msg}', component: 'todo'{', ' + data if data else ''} }});"

    content = re.sub(pattern2, replace2, content)

    # Padrão 3: console.error com ICONS
    pattern3 = r"console\.error\(\`\$\{ICONS\.[A-Z_]+\}\s*([^`]*)\`(?:,\s*([^)]*))?\);"
    def replace3(match):
        nonlocal count
        count += 1
        msg = match.group(1).strip()
        data = match.group(2) or ""
        return f"logError({data or 'new Error(\"' + msg + '\")'}, '{msg}', {{ component: 'todo' }});"

    content = re.sub(pattern3, replace3, content)

    # Padrão 4: Simple console.log (without ICONS)
    pattern4 = r"console\.log\('([^']*)',\s*([^)]*)\);"
    def replace4(match):
        nonlocal count
        count += 1
        msg = match.group(1)
        data = match.group(2)
        return f"log.info({{ msg: '{msg}', {data} }});"

    content = re.sub(pattern4, replace4, content)

    # Padrão 5: console.error simple
    pattern5 = r"console\.error\('([^']*)',\s*([^)]*)\);"
    def replace5(match):
        nonlocal count
        count += 1
        msg = match.group(1)
        data = match.group(2)
        return f"logError({data}, '{msg}', {{ component: 'todo' }});"

    content = re.sub(pattern5, replace5, content)

    # Add import if any refactoring was done and import doesn't exist
    if count > 0 and 'log, logError' not in content:
        if "import { log, logError } from '@/lib/services/logger';" not in content:
            # Find first import statement
            import_match = re.search(r"(import [^;]+;)", content)
            if import_match:
                insert_pos = import_match.end()
                content = content[:insert_pos] + "\nimport { log, logError } from '@/lib/services/logger';" + content[insert_pos:]

    return count, content if count > 0 else original_content

def main():
    if len(sys.argv) < 2:
        print("Usage: python refactor_logs.py <file_path>")
        sys.exit(1)

    filepath = sys.argv[1]

    if not Path(filepath).exists():
        print(f"Error: File not found: {filepath}")
        sys.exit(1)

    count, refactored_content = refactor_file(filepath)

    if count == 0:
        print(f"No console statements found in {filepath}")
    else:
        # Write back to file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(refactored_content)
        print(f"✓ Refactored {count} console statements in {filepath}")

if __name__ == '__main__':
    main()
