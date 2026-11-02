#!/usr/bin/env python3
"""The project's Python environment, the same on Linux, macOS, Windows and CI.

  venv_run.py --create -r requirements-dev.txt [-r ...]   create .venv and install pins
  venv_run.py <tool> [args...]                           run a tool from .venv
                                                         (src/ is put on PYTHONPATH)

Works on PEP 668 system Pythons: if `venv` cannot bootstrap pip (Debian/Ubuntu without
python3-venv), the venv is created without pip and filled by the outer pip (`--python`).
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

VENV = Path('.venv')


def bin_dir(root: Path) -> Path:
    return root / VENV / ('Scripts' if os.name == 'nt' else 'bin')


def python_of(root: Path) -> Path:
    return bin_dir(root) / ('python.exe' if os.name == 'nt' else 'python')


def create(root: Path, requirements: list[str]) -> int:
    py = python_of(root)
    if not py.exists():
        made = subprocess.run([sys.executable, '-m', 'venv', str(root / VENV)], check=False)
        if made.returncode:
            subprocess.run([sys.executable, '-m', 'venv', '--clear', '--without-pip',
                            str(root / VENV)], check=True)
    files = [arg for pair in requirements for arg in ('-r', pair)]
    inner = [str(py), '-m', 'pip', 'install', '--disable-pip-version-check', *files]
    has_pip = subprocess.run([str(py), '-m', 'pip', '--version'], capture_output=True,
                             check=False).returncode == 0
    command = inner if has_pip else [sys.executable, '-m', 'pip', '--python', str(py),
                                     'install', '--disable-pip-version-check', *files]
    return subprocess.run(command, cwd=root, check=False).returncode


def run(root: Path, argv: list[str]) -> int:
    tool = bin_dir(root) / argv[0]
    candidates = [tool, tool.with_suffix('.exe')]
    exe = next((str(path) for path in candidates if path.exists()), None)
    if exe is None:
        print(f'BLOCKED: {argv[0]} is not installed in {VENV} (run the project setup)',
              file=sys.stderr)
        return 127
    env = dict(os.environ)
    if (root / 'src').is_dir():  # src layout: packages importable without installing them
        env['PYTHONPATH'] = os.pathsep.join(filter(None, [str(root / 'src'),
                                                          env.get('PYTHONPATH')]))
    return subprocess.run([exe, *argv[1:]], cwd=root, env=env, check=False).returncode


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    root = Path.cwd()
    if not argv:
        print(__doc__, file=sys.stderr)
        return 1
    if argv[0] == '--create':
        return create(root, [argv[i + 1] for i, a in enumerate(argv[:-1]) if a == '-r'])
    return run(root, argv)


if __name__ == '__main__':
    raise SystemExit(main())
