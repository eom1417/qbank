#!/usr/bin/env python3
"""Conventional Commits for every commit (git commit-msg hook): `type(scope)!: summary`.

  commits.py <message-file>
Merge/revert/fixup commits that git writes itself are accepted unchanged.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

TYPES = ('feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'build', 'ci', 'chore', 'revert',
         'style', 'security')
HEADER = re.compile(rf'^(?:{"|".join(TYPES)})(?:\([a-z0-9][\w./-]*\))?!?: \S.{{0,99}}$')
GIT_WRITTEN = re.compile(r'^(?:Merge |Revert "|fixup! |squash! |amend! |Initial commit$)')


def header_problem(message: str) -> str | None:
    lines = [line for line in message.splitlines() if not line.startswith('#')]
    header = lines[0].strip() if lines else ''
    if GIT_WRITTEN.match(header) or HEADER.match(header):
        return None
    return (f'commit header "{header[:72]}" is not Conventional Commits: write '
            f'"<type>(<scope>): <summary>" with type in {", ".join(TYPES)} (summary <= 100 chars)')


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 1:
        print('usage: commits.py <message-file>', file=sys.stderr)
        return 1
    problem = header_problem(Path(argv[0]).read_text(encoding='utf-8', errors='replace'))
    if problem:
        print(f'FAIL: {problem}', file=sys.stderr)
    return 1 if problem else 0


if __name__ == '__main__':
    raise SystemExit(main())
