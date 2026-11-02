#!/usr/bin/env python3
"""One design system: raw visual values live only in the token owner; features compose
the shared components instead of re-creating native controls.

  design_guard.py [--root DIR]

Active when engineering.json has "applies": {"design": true}. Configuration:
  "design_system": {"tokens": [globs], "components": [globs], "ui": [globs]}
`*` in a glob crosses folders. Files under `tokens` may hold raw values; files under
`components` may use native controls; every other UI file may do neither.
"""
from __future__ import annotations

import fnmatch
import re
from pathlib import Path

from cli import run_guard
from guard_core import collect
from guard_rules import read_source, suffix_of

UI_EXTS = frozenset({'.tsx', '.jsx', '.ts', '.js', '.mjs', '.vue', '.svelte', '.astro', '.html',
                     '.css', '.scss', '.sass', '.less', '.dart', '.swift', '.kt'})
MARKUP_EXTS = frozenset({'.tsx', '.jsx', '.vue', '.svelte', '.astro', '.html'})
_END = r'(?=["\'`\s;,)\]}]|$)'
_HEX_DIGIT = r'#(?=[0-9a-fA-F]*\d)(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})' + _END
_HEX_PROP = (r'(?:color|background|fill|stroke|border|shadow|outline|tint)[\w-]*["\']?\s*[:=]\s*'
             r'["\']?#[0-9a-fA-F]{3,8}\b')
RAW_VALUES = (
    (re.compile(rf'(?<![\w&/]){_HEX_DIGIT}|{_HEX_PROP}', re.I), 'raw color'),
    (re.compile(r'\bColor\(\s*0x[0-9A-Fa-f]{8}\s*\)|\bColor\(\s*red\s*:|\bUIColor\(\s*red\s*:'),
     'raw color'),
    (re.compile(r'\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(', re.I), 'raw color function'),
    (re.compile(r'(?<![\w.$#-])(?:[1-9]\d*(?:\.\d+)?|0\.\d+)(?:px|rem|em|pt|vh|vw|dp|sp|ms)\b'),
     'raw size/duration'),
    (re.compile(r'(?<![\w-])[a-z][\w:-]*-\[[^\]\s]+\]'), 'Tailwind arbitrary value'),
    (re.compile(r'font-family\s*:|fontFamily\s*[:=]\s*["\']', re.I), 'raw font family'),
    (re.compile(r'z-index\s*:\s*-?\d|zIndex\s*[:=]\s*-?\d', re.I), 'raw z-index'),
    (re.compile(r'\b(?:margin|padding|gap|width|height|top|left|right|bottom|inset|fontSize'
                r'|lineHeight|letterSpacing|borderRadius|borderWidth)\w*\s*:\s*[1-9]\d*\s*[,}\n]'),
     'raw spacing number'),
    (re.compile(r'\bEdgeInsets\.\w+\(\s*\d|\bSizedBox\(\s*(?:width|height)\s*:\s*\d'
                r'|\.padding\(\s*\d|\.font\(\s*\.system\(\s*size\s*:'), 'raw spacing/font'),
)
NATIVE = re.compile(r'<(?:button|input|select|textarea|dialog)\b')
_COMMENT = re.compile(r'^\s*(?://|/\*|\*|#(?![0-9a-fA-F]{3})|<!--)')


def matches(rel: str, globs: list[str]) -> bool:
    return any(fnmatch.fnmatchcase(rel, pattern) for pattern in globs)


def config_problems(config) -> list[str]:
    if not isinstance(config, dict):
        return ['applies.design is true: add "design_system": {"tokens": [...], '
                '"components": [...], "ui": [...]} to engineering.json']
    return [f'design_system.{key} must list at least one glob' for key in ('tokens', 'ui')
            if not isinstance(config.get(key), list) or not config.get(key)]


def line_problems(rel: str, line: str, may_be_native: bool) -> list[str]:
    if _COMMENT.match(line):
        return []
    found = [(label, hit.group(0)) for pattern, label in RAW_VALUES
             if (hit := pattern.search(line))]
    if not may_be_native and suffix_of(rel) in MARKUP_EXTS and (hit := NATIVE.search(line)):
        found.append(('native control (use the shared component)', hit.group(0)))
    return [f'{label} "{text}"' for label, text in found]


def file_problems(root: Path, rel: str, config: dict) -> list[str]:
    text, problems = read_source(root, rel)
    if text is None:
        return problems
    native_ok = matches(rel, config.get('components', []))
    for number, line in enumerate(text.splitlines(), start=1):
        problems += [f'{rel}:{number}: {issue} outside the token owner; use a semantic token '
                     'or a design-system component'
                     for issue in line_problems(rel, line, native_ok)]
    return problems


def ui_files(root: Path, manifest: dict, config: dict) -> list[str]:
    tokens, ui = config.get('tokens', []), config.get('ui', [])
    return [rel for rel in collect(root, manifest).owned
            if suffix_of(rel) in UI_EXTS and matches(rel, ui) and not matches(rel, tokens)]


def design_problems(root: Path, manifest: dict) -> tuple[list[str], int]:
    if manifest.get('applies', {}).get('design') is not True:
        return [], 0
    config = manifest.get('design_system')
    problems = config_problems(config)
    if problems:
        return problems, 0
    files = ui_files(root, manifest, config)
    return [p for rel in files for p in file_problems(root, rel, config)], len(files)


def check(root: Path, manifest: dict) -> tuple[list[str], str]:
    problems, count = design_problems(root, manifest)
    return problems, f'{count} UI files use tokens and shared components only'


def main(argv: list[str] | None = None) -> int:
    return run_guard(__doc__, argv, check, 'design issue')


if __name__ == '__main__':
    raise SystemExit(main())
