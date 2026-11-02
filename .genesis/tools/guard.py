#!/usr/bin/env python3
"""Hard 400/50/10 guard. Fails closed.

  guard.py              every authored file: <=400 lines, no inline bypass markers
  guard.py --functions  every authored function: <=50 lines, complexity <=10
  guard.py --files A B  quick feedback for specific files (agent and git hooks)
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

from guard_core import (LOCKFILES, ManifestError, classify, collect, generated_entry,
                        load_manifest, manifest_problems, read_manifest, vendored_skill_dirs)
from guard_rules import (LIZARD_EXTS, MAX_COMPLEXITY, MAX_FUNCTION_LINES,
                         file_problems, has_functions,
                         native_function_problems, suffix_of)
from layout import PROJECT_ROOT, tool
from toolchain import kit_env, lizard_command

ROOT = PROJECT_ROOT


def run_lizard(root: Path, files: list[str]) -> list[str]:
    if not files:
        return []
    command = lizard_command()
    if command is None:
        kinds = ', '.join(sorted({suffix_of(f) for f in files}))
        return [f'BLOCKED: lizard is required to measure {kinds} functions '
                f'(run: python3 {tool("genesis.py")} setup); nothing was verified']
    with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False) as handle:
        handle.write('\n'.join(str(root / f) for f in files))
        listing = handle.name
    try:
        done = subprocess.run(command + ['-C', str(MAX_COMPLEXITY), '-L', str(MAX_FUNCTION_LINES),
                                         '-w', '-f', listing], cwd=root, capture_output=True, text=True,
                              env=kit_env(), check=False)
    finally:
        Path(listing).unlink(missing_ok=True)
    if done.returncode == 0:
        return []
    lines = [line for line in (done.stdout + done.stderr).splitlines() if line.strip()]
    return lines or [f'lizard failed with exit {done.returncode}']


def function_problems(root: Path, files: list[str], manifest: dict) -> list[str]:
    """Every function measured, or an explicit failure saying why it could not be."""
    external = set(manifest.get('external_function_gates', []))
    problems, for_lizard = [], []
    for rel in [f for f in files if has_functions(f, manifest['owned_extensions'])]:
        native = native_function_problems(root, rel)
        suffix = suffix_of(rel)
        if native is not None:
            problems.extend(native)
        elif suffix in LIZARD_EXTS:
            for_lizard.append(rel)
        elif suffix not in external:
            problems.append(f'BLOCKED: {rel}: no function/complexity gate for {suffix}; configure '
                            'a real parser gate and list it in external_function_gates')
    return problems + run_lizard(root, for_lizard)


def report(problems: list[str], summary: str) -> int:
    for issue in problems:
        print(f'FAIL: {issue}', file=sys.stderr)
    if problems:
        print(f'FAIL: {len(problems)} issue(s)')
        return 1
    print(f'PASS: {summary}')
    return 0


def full_scan(root: Path, functions: bool) -> int:
    try:
        manifest = load_manifest(root, require_ready=False)
    except ManifestError as exc:
        return report([str(exc)], '')
    inventory = collect(root, manifest)
    problems = inventory.problems
    if functions:
        problems += function_problems(root, inventory.owned, manifest)
        return report(problems, f'{len(inventory.owned)} authored files: functions <=50 lines, '
                                'complexity <=10')
    problems += [p for rel in inventory.owned for p in file_problems(root, rel)]
    problems += [p for rel in inventory.probes for p in file_problems(root, rel, False)]
    problems += [p for rel in inventory.generated for p in _generated_check(root, rel, manifest)]
    return report(problems, f'{len(inventory.owned)} authored files <=400 lines, zero inline '
                            f'suppressions; {len(inventory.generated)} generated, '
                            f'{inventory.assets} assets, {len(inventory.probes)} proof fixtures')


def _generated_check(root: Path, rel: str, manifest: dict) -> list[str]:
    """Declared generated files are excluded only after check.py regenerates them."""
    entry = generated_entry(rel, manifest)
    if entry is None or rel.rsplit('/', 1)[-1] in LOCKFILES:
        return []
    return [] if entry.get('verify') else [f'{rel}: generated entry has no verify command']


def quick_files(root: Path, paths: list[str]) -> int:
    """Same rules as the full gate for the given files. Never PASS what was not measured."""
    try:
        manifest = read_manifest(root)
    except ManifestError as exc:
        return report([str(exc)], '')
    if manifest_problems(manifest):
        return report(manifest_problems(manifest), '')
    kinds = _kinds(root, paths, manifest)
    problems = [f'{rel}: unclassified file type; classify it in engineering.json'
                for rel in kinds.get('unclassified', [])]
    owned = kinds.get('owned', [])
    problems += [p for rel in owned for p in file_problems(root, rel)]
    problems += function_problems(root, owned, manifest)
    return report(problems, f'{len(owned)} changed file(s) within 400/50/10, no suppressions')


def _kinds(root: Path, paths: list[str], manifest: dict) -> dict[str, list[str]]:
    vendored = vendored_skill_dirs(root)
    kinds: dict[str, list[str]] = {}
    for rel in _relative(root, paths):
        if (root / rel).exists():
            kinds.setdefault(classify(rel, manifest, vendored), []).append(rel)
    return kinds


def _relative(root: Path, paths: list[str]) -> list[str]:
    result = []
    for raw in paths:
        path = Path(raw)
        path = (path if path.is_absolute() else Path.cwd() / path).resolve()
        if path.is_relative_to(root):
            result.append(path.relative_to(root).as_posix())
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--functions', action='store_true')
    parser.add_argument('--files', nargs='+')
    args = parser.parse_args(argv)
    root = args.root.resolve()
    if args.files:
        return quick_files(root, args.files)
    return full_scan(root, args.functions)


if __name__ == '__main__':
    raise SystemExit(main())
