#!/usr/bin/env python3
"""Environment setup driven by engineering.json (single source for CI and local machines).

  bootstrap_env.py --kit        install the kit's own pinned tools into .genesis/.pylib
  bootstrap_env.py --ci         kit tools + every pinned `setup` command of the project
  bootstrap_env.py --git-hooks  route this clone's git hooks to .githooks/
  bootstrap_env.py --recipe python [--var PKG=billing]   apply a proven stack recipe
"""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import recipes
import toolchain
from check import command_problem
from guard_core import ManifestError, read_manifest
from layout import PROJECT_ROOT, tool


def setup_commands(root: Path) -> tuple[list[list[str]], list[str]]:
    try:
        manifest = read_manifest(root)
    except ManifestError as exc:
        return [], [str(exc)]
    commands = manifest.get('setup', [])
    if not isinstance(commands, list) or not commands:
        return [], ['BOOTSTRAP REQUIRED: add pinned install commands to engineering.json "setup"']
    problems = [p for c in commands if (p := command_problem('setup', c))]
    return commands, problems


def install_kit() -> int:
    problems = toolchain.ensure()
    for problem in problems:
        print(f'FAIL: {problem}')
    print('FAIL: kit tools missing' if problems else 'PASS: kit tools ready (lizard pinned)')
    return 1 if problems else 0


def install(root: Path) -> int:
    if install_kit():
        return 1
    commands, problems = setup_commands(root)
    for problem in problems:
        print(f'FAIL: {problem}')
    if problems:
        return 1
    for command in commands:
        print('SETUP: ' + ' '.join(command), flush=True)
        if subprocess.run(command, cwd=root, check=False).returncode:
            print('FAIL: setup command failed')
            return 1
    return 0


def git_hooks(root: Path) -> int:
    for hook in (root / '.githooks').glob('*'):
        hook.chmod(0o755)
    done = subprocess.run(['git', '-C', str(root), 'config', 'core.hooksPath', '.githooks'],
                          check=False)
    print('PASS: git hooks active (pre-commit fast gate, commit-msg, pre-push full gate)'
          if done.returncode == 0 else 'FAIL: not a git repository')
    return done.returncode


def apply_recipe(root: Path, name: str, pairs: list[str]) -> int:
    variables = dict(pair.split('=', 1) for pair in pairs if '=' in pair)
    notes = recipes.apply(root, name, variables)
    for note in notes:
        print(f'NOTE: {note}')
    blocked = any('unknown recipe' in n or 'unfilled' in n for n in notes)
    print('FAIL: recipe not applied' if blocked else
          f'APPLIED: {name}. Next: python3 {tool("genesis.py")} setup --project, then prove')
    return 1 if blocked else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--kit', action='store_true')
    mode.add_argument('--ci', action='store_true')
    mode.add_argument('--git-hooks', action='store_true')
    mode.add_argument('--recipe')
    parser.add_argument('--var', action='append', default=[], metavar='KEY=VALUE')
    parser.add_argument('--root', type=Path, default=PROJECT_ROOT)
    args = parser.parse_args(argv)
    root = args.root.resolve()
    if args.recipe:
        return apply_recipe(root, args.recipe, args.var)
    if args.kit:
        return install_kit()
    return install(root) if args.ci else git_hooks(root)


if __name__ == '__main__':
    raise SystemExit(main())
