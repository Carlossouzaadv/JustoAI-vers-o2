#!/usr/bin/env python3
"""
Script to refactor console.log/warn/error to use Pino logger
"""
import re
import sys
from pathlib import Path

def has_logger_import(content: str) -> bool:
    """Check if file already has logger import"""
    return 'from \'@/lib/services/logger\'' in content or 'from "@/lib/services/logger"' in content

def add_logger_import(content: str) -> str:
    """Add logger import to file if not present"""
    if has_logger_import(content):
        return content

    # Find the last import statement
    import_pattern = r'^import\s+.*?;?\s*$'
    lines = content.split('\n')
    last_import_idx = -1

    for i, line in enumerate(lines):
        if re.match(import_pattern, line.strip()):
            last_import_idx = i

    if last_import_idx >= 0:
        # Insert after last import
        lines.insert(last_import_idx + 1, "import { log, logError } from '@/lib/services/logger';")
        return '\n'.join(lines)
    else:
        # Add at beginning if no imports found
        return "import { log, logError } from '@/lib/services/logger';\n\n" + content

def refactor_console_error(content: str) -> str:
    """Refactor console.error to logError or log.error"""

    # Pattern 1: console.error with string prefix and error object
    # Example: console.error('[Component] Error:', error)
    pattern1 = r'console\.error\(\s*[\'"`]([^\'"`]+)[\'"`]\s*,\s*(\w+)\s*\)'

    def replace1(match):
        msg = match.group(1)
        error_var = match.group(2)
        # Clean up message
        msg = msg.replace('[', '').replace(']', '').strip()
        return f'logError({error_var}, "{msg}", {{ component: "refactored" }})'

    content = re.sub(pattern1, replace1, content)

    # Pattern 2: console.error with template literal or concatenation
    # Example: console.error(`Error: ${something}`)
    pattern2 = r'console\.error\(\s*`([^`]+)`\s*\)'

    def replace2(match):
        msg = match.group(1)
        # If it contains interpolation, convert to structured log
        if '${' in msg:
            # Simple case: just use log.error with structured format
            msg_clean = re.sub(r'\$\{[^}]+\}', '', msg).strip()
            return f'log.error({{ msg: "{msg_clean}" }})'
        else:
            return f'log.error({{ msg: "{msg}" }})'

    content = re.sub(pattern2, replace2, content)

    # Pattern 3: Simple console.error
    pattern3 = r'console\.error\(\s*[\'"`]([^\'"`]+)[\'"`]\s*\)'
    content = re.sub(pattern3, r'log.error({ msg: "\1" })', content)

    return content

def refactor_console_warn(content: str) -> str:
    """Refactor console.warn to log.warn"""

    # Pattern 1: console.warn with template literal
    pattern1 = r'console\.warn\(\s*`([^`]+)`\s*\)'

    def replace1(match):
        msg = match.group(1)
        if '${' in msg:
            msg_clean = re.sub(r'\$\{[^}]+\}', '', msg).strip()
            return f'log.warn({{ msg: "{msg_clean}" }})'
        else:
            return f'log.warn({{ msg: "{msg}" }})'

    content = re.sub(pattern1, replace1, content)

    # Pattern 2: console.warn with string and error
    pattern2 = r'console\.warn\(\s*[\'"`]([^\'"`]+)[\'"`]\s*,\s*(\w+)\s*\)'

    def replace2(match):
        msg = match.group(1)
        error_var = match.group(2)
        msg = msg.replace('[', '').replace(']', '').strip()
        return f'logError({error_var}, "{msg}", {{ component: "refactored" }})'

    content = re.sub(pattern2, replace2, content)

    # Pattern 3: Simple console.warn
    pattern3 = r'console\.warn\(\s*[\'"`]([^\'"`]+)[\'"`]\s*\)'
    content = re.sub(pattern3, r'log.warn({ msg: "\1" })', content)

    return content

def refactor_console_log(content: str) -> str:
    """Refactor console.log to log.info"""

    # Pattern 1: console.log with template literal
    pattern1 = r'console\.log\(\s*`([^`]+)`\s*\)'

    def replace1(match):
        msg = match.group(1)
        if '${' in msg:
            msg_clean = re.sub(r'\$\{[^}]+\}', '', msg).strip()
            return f'log.info({{ msg: "{msg_clean}" }})'
        else:
            return f'log.info({{ msg: "{msg}" }})'

    content = re.sub(pattern1, replace1, content)

    # Pattern 2: Simple console.log
    pattern2 = r'console\.log\(\s*[\'"`]([^\'"`]+)[\'"`]\s*\)'
    content = re.sub(pattern2, r'log.info({ msg: "\1" })', content)

    return content

def refactor_file(file_path: Path) -> tuple[bool, int]:
    """Refactor a single file. Returns (success, count_of_statements_changed)"""
    try:
        content = file_path.read_text(encoding='utf-8')
        original_content = content

        # Count console statements before
        count_before = len(re.findall(r'console\.(log|warn|error)', content))

        if count_before == 0:
            return True, 0

        # Add logger import
        content = add_logger_import(content)

        # Refactor console statements
        content = refactor_console_error(content)
        content = refactor_console_warn(content)
        content = refactor_console_log(content)

        # Count console statements after
        count_after = len(re.findall(r'console\.(log|warn|error)', content))
        statements_converted = count_before - count_after

        # Only write if changes were made
        if content != original_content:
            file_path.write_text(content, encoding='utf-8')
            return True, statements_converted

        return True, 0

    except Exception as e:
        print(f"Error refactoring {file_path}: {e}", file=sys.stderr)
        return False, 0

def main():
    if len(sys.argv) < 2:
        print("Usage: python refactor-logger.py <file1> [file2] ...")
        sys.exit(1)

    results = []
    for file_arg in sys.argv[1:]:
        file_path = Path(file_arg)
        if not file_path.exists():
            print(f"File not found: {file_path}", file=sys.stderr)
            continue

        success, count = refactor_file(file_path)
        if success:
            results.append((file_path.name, count))
            print(f"✓ {file_path.name}: {count} statements converted")
        else:
            print(f"✗ {file_path.name}: Failed", file=sys.stderr)

    print("\nSummary:")
    for name, count in results:
        print(f"  {name}: {count} statements")
    print(f"Total files: {len(results)}")
    print(f"Total statements: {sum(c for _, c in results)}")

if __name__ == '__main__':
    main()
