"""Per-file rules: 400 lines, bypass markers, native Python/shell 50/10 metrics.

Thresholds are constants on purpose: they are not configurable per project.
"""
from __future__ import annotations

import ast
import os
import re
from pathlib import Path

MAX_FILE_LINES = 400
MAX_FUNCTION_LINES = 50
MAX_COMPLEXITY = 10

DOC_EXTS = frozenset({'.md', '.mdx', '.rst', '.txt'})
NO_FUNCTION_EXTS = DOC_EXTS | frozenset({
    '.json', '.jsonc', '.yaml', '.yml', '.toml', '.xml', '.ini', '.cfg', '.csv',
    '.graphql', '.gql', '.proto', '.tf', '.tfvars', '.hcl', '.prisma', '.css',
    '.scss', '.sass', '.less', '.html', '.htm', '.svg', '.properties', '',
})
SHELL_EXTS = frozenset({'.sh', '.bash', '.zsh'})
LIZARD_EXTS = frozenset({
    '.c', '.cc', '.cpp', '.cxx', '.h', '.hh', '.hpp', '.java', '.cs', '.js',
    '.cjs', '.mjs', '.jsx', '.ts', '.tsx', '.vue', '.m', '.mm', '.rb', '.php',
    '.swift', '.scala', '.gd', '.go', '.lua', '.rs', '.kt', '.kts', '.sol',
    '.erl', '.hrl', '.zig', '.pl', '.pm', '.r', '.R', '.sql', '.f90', '.f95',
})

_J = ''.join  # markers are assembled from pieces so this file never matches itself
# Zero inline suppressions: every mechanism that silences a tool from inside a file.
_SUPPRESSIONS = (
    ([r'(?:#|//|/\*|--|;)\s*(?:ruff:\s*)?', 'no', r'qa\b'], 'noqa', re.I),
    ([r'\b(?:type|pyright|mypy)\s*:\s*', 'ign', 'ore'], 'type-check ignore', re.I),
    ([r'\b(?:py|ty)', r'lint\s*:\s*disable'], 'pylint disable', re.I),
    ([r'\bpragma\s*:\s*no\s*', 'cover'], 'coverage exclusion', re.I),
    ([r'(?:#|//)\s*', 'nos', r'(?:ec|emgrep)\b'], 'security scanner suppression', re.I),
    (['eslint', r'-disable'], 'ESLint disable', 0),
    ([r'/\*\s*eslint\s+[@\w/-]+\s*:\s*["\']?(?:off|0|warn|1)'], 'inline ESLint rule off', 0),
    ([r'@ts-', r'(?:ignore|nocheck|expect-error)\b'], 'TypeScript suppression', 0),
    ([r'\b(?:istanbul|c8|v8)\s+', 'ign', 'ore'], 'coverage exclusion', 0),
    ([r'\b(?:prettier|biome|deno-lint)-', 'ign', 'ore'], 'formatter/linter ignore', 0),
    ([r'\b(?:stylelint|swiftlint|rubocop|phpcs)\s*[:-]\s*', r'(?:disable|ignore)'],
     'linter disable', re.I),
    ([r'//\s*', 'no', r'lint\b'], 'nolint', re.I),
    ([r'//\s*lint:', r'(?:ignore|file-ignore)\b'], 'staticcheck ignore', 0),
    ([r'#!?\[', r'allow\s*\('], 'Rust allow attribute', 0),
    ([r'@Suppress', r'(?:Warnings)?\s*\('], 'JVM suppression', 0),
    ([r'\bSuppress', r'Message\s*\(|#pragma\s+warning\s+disable'], 'C# suppression', 0),
    ([r'\bNO', r'LINT\b|\bNO', r'SONAR\b|\bNO', r'PMD\b|CHECK', r'STYLE\s*:?\s*OFF'],
     'analyzer suppression', 0),
    ([r'@(?:phpstan|psalm)-', r'(?:ignore|suppress)'], 'PHP analyzer suppression', 0),
    ([r'shellcheck\s+', 'disable'], 'shellcheck directive', 0),
    ([r'//\s*', r'ignore(?:_for_file)?\s*:'], 'Dart analyzer ignore', 0),
    (['liz', r'ard\s+forgive'], 'lizard suppression', re.I),
    ([r'(?:gitleaks|jscpd|knip)\s*:\s*', r'(?:allow|ignore)'], 'scanner ignore', re.I),
)
BYPASS_PATTERNS = tuple((re.compile(_J(parts), flags), label)
                        for parts, label, flags in _SUPPRESSIONS) + (
    (re.compile(_J([r'["\'](?:max-lines|max-lines-per-function|complexity)["\']\s*:\s*',
                    r'\[?\s*["\']?(?:off|warn|0|1)\b'])), 'size/complexity rule switched off'),
)
_THRESHOLD = re.compile(_J(['max', r'[-_]complexity\s*[=:]\s*(\d+)']), re.I)

_SCOPES = (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)
_BRANCHES = tuple(node for node in (
    ast.If, ast.IfExp, ast.For, ast.AsyncFor, ast.While, ast.ExceptHandler,
    getattr(ast, 'match_case', None)) if node is not None)
_SHELL_BRANCH = re.compile(r'(?<![\w-])(?:if|elif|while|until|for|case)(?![\w-])|&&|\|\||;;')


def suffix_of(rel: str) -> str:
    return os.path.splitext(rel.rsplit('/', 1)[-1])[1]


def read_source(root: Path, rel: str) -> tuple[str | None, list[str]]:
    path = root / rel
    if path.is_symlink() or not path.is_file():
        return None, [f'{rel}: authored file must be a regular file, not a symlink']
    try:
        return path.read_text(encoding='utf-8'), []
    except (OSError, UnicodeError) as exc:
        return None, [f'{rel}: cannot read as UTF-8: {exc}']


def file_problems(root: Path, rel: str, scan_bypass: bool = True) -> list[str]:
    """400-line limit plus inline-suppression detection for one authored file."""
    text, problems = read_source(root, rel)
    if text is None:
        return problems
    count = len(text.splitlines())
    if count > MAX_FILE_LINES:
        problems.append(f'{rel}: {count} physical lines > {MAX_FILE_LINES}')
    return problems + (bypass_problems(rel, text) if scan_bypass else [])


def bypass_problems(rel: str, text: str) -> list[str]:
    if suffix_of(rel) in DOC_EXTS:
        return []
    problems = []
    for number, line in enumerate(text.splitlines(), start=1):
        problems.extend(_line_bypasses(rel, number, line))
    return problems


def _line_bypasses(rel: str, number: int, line: str) -> list[str]:
    found = [f'{rel}:{number}: forbidden {label}'
             for pattern, label in BYPASS_PATTERNS if pattern.search(line)]
    match = _THRESHOLD.search(line)
    if match and int(match.group(1)) > MAX_COMPLEXITY:
        found.append(f'{rel}:{number}: complexity threshold raised above {MAX_COMPLEXITY}')
    return found


def has_functions(rel: str, owned_extensions) -> bool:
    """Code files need a function gate; config matched only by file name does not."""
    suffix = suffix_of(rel)
    known_code = suffix in LIZARD_EXTS or suffix in SHELL_EXTS or suffix in ('.py', '.pyi')
    return known_code or (suffix in owned_extensions and suffix not in NO_FUNCTION_EXTS)


def native_function_problems(root: Path, rel: str) -> list[str] | None:
    """Python and shell are measured natively; None means 'not native'."""
    suffix = suffix_of(rel)
    if suffix not in ('.py', '.pyi') and suffix not in SHELL_EXTS:
        return None
    text, problems = read_source(root, rel)
    if text is None:
        return problems
    if suffix in SHELL_EXTS:
        return shell_problems(rel, text)
    return python_problems(rel, text)


def python_problems(rel: str, text: str) -> list[str]:
    try:
        tree = ast.parse(text, filename=rel)
    except SyntaxError as exc:
        return [f'{rel}: Python syntax error: {exc}']
    problems = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            problems.extend(_python_function(rel, node))
    return problems


def _python_function(rel: str, node) -> list[str]:
    start = min([node.lineno] + [d.lineno for d in getattr(node, 'decorator_list', [])])
    name = getattr(node, 'name', 'lambda')
    problems = []
    length = node.end_lineno - start + 1
    if length > MAX_FUNCTION_LINES:
        problems.append(f'{rel}:{start}: {name} is {length} lines > {MAX_FUNCTION_LINES}')
    score = cyclomatic(node)
    if score > MAX_COMPLEXITY:
        problems.append(f'{rel}:{start}: {name} has complexity {score} > {MAX_COMPLEXITY}')
    return problems


def cyclomatic(func) -> int:
    """Classic McCabe: 1 + decision points, boolean operators included."""
    total = 1
    stack = list(ast.iter_child_nodes(func))
    while stack:
        node = stack.pop()
        if isinstance(node, _SCOPES):
            continue
        total += _weight(node)
        stack.extend(ast.iter_child_nodes(node))
    return total


def _weight(node) -> int:
    if isinstance(node, _BRANCHES):
        return 1
    if isinstance(node, ast.BoolOp):
        return len(node.values) - 1
    if isinstance(node, ast.comprehension):
        return 1 + len(node.ifs)
    return 0


def shell_problems(rel: str, text: str) -> list[str]:
    """No shell parser exists: bound the whole file as if it were one function."""
    problems = []
    lines = text.splitlines()
    if len(lines) > MAX_FUNCTION_LINES:
        problems.append(f'{rel}: shell file is {len(lines)} lines > {MAX_FUNCTION_LINES}; '
                        'move logic into the main language')
    code = [line for line in lines if not line.lstrip().startswith('#')]
    score = 1 + sum(len(_SHELL_BRANCH.findall(line)) for line in code)
    if score > MAX_COMPLEXITY:
        problems.append(f'{rel}: shell file branching {score} > {MAX_COMPLEXITY}')
    return problems
