"""The one shape of a kit guard's command line: --root, manifest, FAIL lines, PASS summary."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Callable

from guard_core import ManifestError, load_manifest
from layout import PROJECT_ROOT

Check = Callable[[Path, dict], tuple[list[str], str]]


def run_guard(doc: str, argv: list[str] | None, check: Check, noun: str) -> int:
    """check(root, manifest) -> (problems, pass summary). Exit 1 on any problem."""
    parser = argparse.ArgumentParser(description=doc,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--root', type=Path, default=PROJECT_ROOT)
    root = parser.parse_args(argv).root.resolve()
    try:
        manifest = load_manifest(root, require_ready=False)
    except ManifestError as exc:
        print(f'FAIL: {exc}')
        return 1
    problems, summary = check(root, manifest)
    for problem in problems:
        print(f'FAIL: {problem}', file=sys.stderr)
    print(f'FAIL: {len(problems)} {noun}(s)' if problems else f'PASS: {summary}')
    return 1 if problems else 0
