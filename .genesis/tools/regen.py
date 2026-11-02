"""Prove that declared generated files really are generated.

The files are moved out of the repository, the entry's `verify` command runs, and every
file must come back byte-for-byte. A command that does not generate them (or restores them
from git or a copy) cannot pass. The originals are always put back.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from guard_core import collect, path_matches


def verify_generated(root: Path, manifest: dict) -> list[str]:
    problems = []
    for item in manifest.get('generated', []):
        problems += _regenerates(root, manifest, item)
    return problems


def _regenerates(root: Path, manifest: dict, item: dict) -> list[str]:
    files = [rel for rel in collect(root, manifest).generated
             if path_matches(rel, item['pattern'])]
    if not files:
        return [f'generated {item["pattern"]!r}: matches no file; remove the entry']
    before = {rel: (root / rel).read_bytes() for rel in files}
    try:
        code, missing = _run_without(root, item['verify'], before)
    finally:
        for rel, data in before.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_bytes(data)
    if code or missing:
        return [f'generated {item["pattern"]!r}: removing the files and running verify did not '
                f'recreate them identically (exit {code}; not reproduced: {missing[:3]})']
    return []


def _run_without(root: Path, command: list[str], before: dict[str, bytes]):
    """Delete the files (originals are held in memory), run the generator, compare."""
    for rel in before:
        (root / rel).unlink()
    try:
        code = subprocess.run(command, cwd=root, capture_output=True, check=False).returncode
    except OSError as exc:
        return f'BLOCKED: {exc}', list(before)
    missing = [rel for rel, data in before.items()
               if not (root / rel).is_file() or (root / rel).read_bytes() != data]
    return code, missing
