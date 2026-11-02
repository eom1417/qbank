"""What makes a proof *specific*: the gate must fail because of its own kind of violation.

Three rules, applied by prove.py after a gate went red on its fixture:
  1. Reserved commands: the kit's size guard may only prove function_length/complexity, and
     one command may not certify two unrelated gates.
  2. Signature + control: security, architecture and duplication fixtures must contain a
     recognisable violation of that kind; the kit then removes exactly that part and the
     gate must turn green. A gate that stays red failed for something else.
  3. No size violations in other fixtures: a long or branchy function cannot be the
     "violation" that proves lint, types, security, ...
"""
from __future__ import annotations

import re
from pathlib import Path

from guard_rules import (MAX_FUNCTION_LINES, SHELL_EXTS, python_problems, shell_problems,
                         suffix_of)

SIZE_GATES = frozenset({'function_length', 'complexity'})
SHARED_OK = (SIZE_GATES,)

_SECRET = (r'AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36}|xox[abprs]-[A-Za-z0-9-]{10,}'
           r'|sk_live_[A-Za-z0-9]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'
           r'|(?:password|passwd|secret|api_?key)\s*[:=]\s*["\'][^"\']{8,}["\']')
_DANGEROUS = (r'shell\s*=\s*True|\beval\s*\(|\bexec\s*\(|pickle\.loads?\s*\(|yaml\.load\s*\('
              r'|os\.system\s*\(|\.innerHTML\s*=|dangerouslySetInnerHTML|child_process'
              r'|hashlib\.md5|\bmd5\s*\(|verify\s*=\s*False|InsecureSkipVerify\s*:\s*true'
              r'|\bexec\.Command\s*\(\s*"(?:sh|bash)"|Runtime\.getRuntime\(\)\.exec'
              r'|(?:SELECT|INSERT|UPDATE|DELETE)\b[^;\n]*["\']\s*\+')
_IMPORT = (r'^\s*(?:import\b|from\s+\S+\s+import\b|export\s+[^\n]*\bfrom\b|use\s+[\w:]+'
           r'|#include\b|require\s*\(|"[\w.\-/]+"\s*$)|\brequire\s*\(')
SIGNATURES = {
    'security': re.compile(f'(?:{_SECRET}|{_DANGEROUS})', re.I),
    'architecture': re.compile(_IMPORT, re.M),
}
_DUP_LINES = 6


def command_problems(plan: list) -> list[str]:
    """Rule 1: reserved and shared commands."""
    users: dict[tuple, set[str]] = {}
    problems = []
    for name, command, folder in plan:
        if folder is None:
            continue
        if _is_size_guard(command) and name not in SIZE_GATES:
            problems.append(f'{name}: tools/guard.py measures size only; it cannot prove {name}')
        users.setdefault(tuple(command), set()).add(name)
    for command, names in users.items():
        if len(names) > 1 and not any(names <= group for group in SHARED_OK):
            problems.append(f'{", ".join(sorted(names))}: one command cannot certify unrelated '
                            f'gates ({" ".join(command)})')
    return problems


def _is_size_guard(command: list[str]) -> bool:
    return any(Path(arg).name == 'guard.py' for arg in command)


def fixture_kind_problems(name: str, items: list[tuple[Path, str]]) -> list[str]:
    """Static part of rules 2 and 3, checked before anything runs."""
    texts = {target: path.read_text(encoding='utf-8', errors='replace') for path, target in items}
    if name in SIGNATURES and not any(SIGNATURES[name].search(t) for t in texts.values()):
        return [f'{name}: fixture has no recognisable {name} violation (see proof_semantics.py)']
    if name == 'duplication' and not _has_duplicate(list(texts.values())):
        return [f'duplication: fixture needs two files sharing {_DUP_LINES}+ identical lines']
    if name not in SIZE_GATES:
        return _size_violations(name, items)
    return []


def _has_duplicate(texts: list[str]) -> bool:
    blocks = [_windows(text) for text in texts]
    return any(blocks[i] & blocks[j] for i in range(len(blocks)) for j in range(i + 1, len(blocks)))


def _windows(text: str) -> set[tuple[str, ...]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return {tuple(lines[i:i + _DUP_LINES]) for i in range(len(lines) - _DUP_LINES + 1)}


def _size_violations(name: str, items: list[tuple[Path, str]]) -> list[str]:
    """Python/shell measured exactly; other languages bounded: a fixture over 50 lines is
    treated as a possible size violation (fixtures should be minimal anyway)."""
    found = []
    for path, target in items:
        text = path.read_text(encoding='utf-8', errors='replace')
        suffix = suffix_of(target)
        if suffix in ('.py', '.pyi'):
            hit = [p for p in python_problems(target, text) if 'syntax error' not in p]
        elif suffix in SHELL_EXTS:
            hit = shell_problems(target, text)
        else:
            hit = len(text.splitlines()) > MAX_FUNCTION_LINES
        if hit:
            found.append(target)
    return [f'{name}: fixture {t} breaks 50/10; a size violation cannot prove {name}'
            for t in found]


def control_items(name: str, items: list[tuple[Path, str]], scratch: Path):
    """Rule 2: the same fixture with only the violation removed (None = no control)."""
    if name == 'duplication':
        return items[:1]
    if name not in SIGNATURES:
        return None
    controls = []
    for index, (path, target) in enumerate(items):
        lines = path.read_text(encoding='utf-8', errors='replace').splitlines()
        kept = [_neutral(line, target) if SIGNATURES[name].search(line) else line
                for line in lines]
        copy = scratch / f'{index}.probe'
        copy.write_text('\n'.join(kept) + '\n', encoding='utf-8')
        controls.append((copy, target))
    return controls


def _neutral(line: str, target: str) -> str:
    """Replace a violating line with a harmless one that keeps the file parseable."""
    indent = line[:len(line) - len(line.lstrip())]
    suffix = suffix_of(target)
    if suffix in ('.py', '.pyi'):
        return indent + 'pass'
    return indent + ('#' if suffix in SHELL_EXTS | {'.rb', '.yaml', '.yml', '.toml'} else '//')
