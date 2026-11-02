#!/usr/bin/env python3
"""Copy-paste guard for every language: repeated logic must live in one owner.

  duplication.py [--root DIR]

Compares all authored code files (tests included) after normalising each line: blank and
comment-only lines, imports and trivial lines (`}`, `end`, `else:` ...) are ignored, and
whitespace is collapsed. Any run of MIN_CLONE_LINES significant lines that appears twice is
a clone. The threshold is a constant, like 400/50/10. Stack tools (jscpd, pylint
duplicate-code, dupl) may add token-level detection on top; this guard needs nothing.
"""
from __future__ import annotations

import re
from pathlib import Path

from cli import run_guard
from guard_core import collect
from guard_rules import has_functions, read_source

MIN_CLONE_LINES = 8
MIN_CLONE_CHARS = 100  # a window of tiny lines (`}`, `end`, 1-token rows) is not logic
_COMMENT = re.compile(r'^(?:#|//|/\*|\*|--|<!--|;|%|\')')
_IMPORT = re.compile(r'^(?:import\b|from\s+\S+\s+import\b|export\s+\*|export\s+\{[^}]*\}\s+from'
                     r'|(?:const|let|var)\s+\w+\s*=\s*require\(|use\s+[\w:\\]+|#include\b'
                     r'|package\s+[\w.]+|using\s+[\w.]+;|require(?:_relative)?\s)')
_WORD = re.compile(r'\w')


def significant(text: str) -> list[tuple[int, str]]:
    """(line number, normalised text) for every line that can carry logic."""
    kept = []
    for number, raw in enumerate(text.splitlines(), start=1):
        line = ' '.join(raw.split())
        if not line or _COMMENT.match(line) or _IMPORT.match(line):
            continue
        if len(_WORD.findall(line)) < 4:
            continue
        kept.append((number, line))
    return kept


def windows(rel: str, lines: list[tuple[int, str]]) -> dict[tuple[str, ...], list]:
    found: dict[tuple[str, ...], list] = {}
    for start in range(len(lines) - MIN_CLONE_LINES + 1):
        chunk = lines[start:start + MIN_CLONE_LINES]
        key = tuple(text for _, text in chunk)
        if sum(map(len, key)) >= MIN_CLONE_CHARS:
            found.setdefault(key, []).append((rel, start, chunk[0][0]))
    return found


def clones(root: Path, files: list[str]) -> list[str]:
    """One finding per pair of places that share a clone (first line of each copy)."""
    index: dict[tuple[str, ...], list] = {}
    for rel in files:
        text, _ = read_source(root, rel)
        for key, places in windows(rel, significant(text or '')).items():
            index.setdefault(key, []).extend(places)
    pairs: dict[tuple[str, str], tuple[int, int]] = {}
    for places in index.values():
        for first, second in _distinct_pairs(places):
            pair = (first[0], second[0])
            pairs.setdefault(pair, (first[2], second[2]))
    return [f'{a}:{la} and {b}:{lb} repeat {MIN_CLONE_LINES}+ identical lines; move the logic '
            'to one owner and call it from both places'
            for (a, b), (la, lb) in sorted(pairs.items())]


def _distinct_pairs(places: list) -> list:
    """Copies in different files, or far enough apart in the same file not to overlap."""
    result = []
    for i, first in enumerate(places):
        for second in places[i + 1:]:
            same_file = first[0] == second[0]
            if not same_file or abs(first[1] - second[1]) >= MIN_CLONE_LINES:
                result.append((first, second))
    return result


def code_files(root: Path, manifest: dict) -> list[str]:
    owned = collect(root, manifest).owned
    return [rel for rel in owned if has_functions(rel, manifest['owned_extensions'])]


def check(root: Path, manifest: dict) -> tuple[list[str], str]:
    files = code_files(root, manifest)
    return clones(root, files), f'{len(files)} code files, no repeated block of ' \
                                f'{MIN_CLONE_LINES}+ lines'


def main(argv: list[str] | None = None) -> int:
    return run_guard(__doc__, argv, check, 'clone')


if __name__ == '__main__':
    raise SystemExit(main())
