#!/usr/bin/env python3
"""Copy this kit into a project folder without ever overwriting the project's files.

  install.py --into DIR
New files are copied; identical files are skipped; a different existing file is left
untouched and the kit version is written next to it as `<file>.genesis-new` to merge by hand.
"""
from __future__ import annotations

import argparse
import filecmp
import os
import shutil
import subprocess
from pathlib import Path

from layout import JOURNAL, LEDGER, PROJECT_ROOT, PYLIB, BACKUP_DIR

SKIP_PARTS = frozenset({'.git', '__pycache__', 'node_modules', '.pytest_cache'})
SKIP_PREFIXES = (PYLIB + '/', BACKUP_DIR + '/', JOURNAL, LEDGER)
CONFLICT_SUFFIX = '.genesis-new'


def kit_files(kit: Path) -> list[str]:
    """Tracked files when the kit is a git checkout, otherwise every non-scratch file."""
    done = subprocess.run(['git', '-C', str(kit), 'ls-files', '--cached', '--others',
                           '--exclude-standard', '-z'], capture_output=True,
                          check=False)
    if done.returncode == 0 and done.stdout:
        names = [n for n in done.stdout.decode().split('\0') if n]
    else:
        names = [p.relative_to(kit).as_posix() for p in kit.rglob('*') if p.is_file()]
    return sorted(n for n in names if _wanted(n) and (kit / n).is_file())


def _wanted(rel: str) -> bool:
    if any(part in SKIP_PARTS for part in rel.split('/')):
        return False
    return not rel.startswith(SKIP_PREFIXES) and not rel.endswith(CONFLICT_SUFFIX)


def install(kit: Path, target: Path) -> tuple[int, int, list[str]]:
    """(copied, identical, conflicts)."""
    copied, same, conflicts = 0, 0, []
    for rel in kit_files(kit):
        source, dest = kit / rel, target / rel
        if dest.is_file() and filecmp.cmp(source, dest, shallow=False):
            same += 1
            continue
        if dest.exists() or dest.is_symlink():
            dest = dest.with_name(dest.name + CONFLICT_SUFFIX)
            conflicts.append(rel)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
        copied += 1
    for hook in (target / '.githooks').glob('*'):
        hook.chmod(hook.stat().st_mode | 0o111)
    return copied, same, conflicts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--into', type=Path, required=True)
    args = parser.parse_args(argv)
    target = args.into.expanduser().resolve()
    if target == PROJECT_ROOT or PROJECT_ROOT in target.parents:
        print(f'FAIL: {target} is inside the kit itself; choose the project folder')
        return 1
    target.mkdir(parents=True, exist_ok=True)
    copied, same, conflicts = install(PROJECT_ROOT, target)
    print(f'INSTALLED into {target}: {copied} written, {same} already identical')
    for rel in conflicts:
        print(f'MERGE: {rel} existed; the kit version is {rel}{CONFLICT_SUFFIX} '
              '(merge by hand, then delete it)')
    print(f'NEXT: cd {os.fspath(target)} && python3 .genesis/tools/genesis.py doctor')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
