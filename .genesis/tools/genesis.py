#!/usr/bin/env python3
"""Project Genesis: one command for everything. Run from the project root.

  genesis.py doctor                  read-only health report and the next step
  genesis.py setup [--project]       kit tools (pinned, hash-checked); --project adds the
                                     project's pinned `setup` commands (CI uses this)
  genesis.py check [--full|--release|--only GATE]   run gates (fast by default)
  genesis.py prove                   full gates + plant every fixture, require red, record
  genesis.py guard [--functions|--files F...]       the 400/50/10 + bypass guard alone
  genesis.py skills --check|--apply|--sync|--index|--install-user|--evals
  genesis.py recipe python|typescript|go|web-design [--var KEY=VALUE]
  genesis.py hooks                   activate .githooks for this clone
  genesis.py governance --plan|--apply|--verify     GitHub label + branch protection
  genesis.py install --into DIR      copy this kit into a project (never overwrites)
  genesis.py selftest                the kit's own test suite
"""
from __future__ import annotations

import importlib
import subprocess
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
# command -> (module, fixed leading arguments)
COMMANDS = {
    'doctor': ('doctor', []),
    'check': ('check', []),
    'prove': ('check', ['--full', '--prove']),
    'guard': ('guard', []),
    'skills': ('skills_policy', []),
    'evals': ('skill_evals', []),
    'recipe': ('bootstrap_env', ['--recipe']),
    'hooks': ('bootstrap_env', ['--git-hooks']),
    'governance': ('github_setup', []),
    'install': ('install', []),
    'duplication': ('duplication', []),
    'design': ('design_guard', []),
    'commit-msg': ('commits', []),
}


def setup(args: list[str]) -> list[str]:
    return ['--ci'] if '--project' in args else ['--kit']


def selftest() -> int:
    command = [sys.executable, '-m', 'unittest', 'discover', '-s', str(TOOLS), '-p', 'test_*.py']
    return subprocess.run(command, check=False).returncode


def dispatch(argv: list[str]) -> int:
    if not argv or argv[0] in ('-h', '--help', 'help'):
        print(__doc__)
        return 0 if argv else 1
    name, rest = argv[0], argv[1:]
    if name == 'selftest':
        return selftest()
    if name == 'setup':
        return importlib.import_module('bootstrap_env').main(setup(rest))
    if name == 'skills' and rest == ['--evals']:
        name, rest = 'evals', []
    if name not in COMMANDS:
        print(f'unknown command {name!r}\n{__doc__}', file=sys.stderr)
        return 1
    module, fixed = COMMANDS[name]
    return importlib.import_module(module).main(fixed + rest)


if __name__ == '__main__':
    sys.path.insert(0, str(TOOLS))
    raise SystemExit(dispatch(sys.argv[1:]))
