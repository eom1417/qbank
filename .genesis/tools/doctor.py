#!/usr/bin/env python3
"""One read-only health report: what is installed, what is proven, what to do next.

  doctor.py [--root DIR]
Exit 0 when nothing is broken (pending owner steps are reported, not failed).
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

import prove
import skills_policy
from check import FULL, command_problem, commands_of
from guard_core import ManifestError, load_manifest
from layout import BLUEPRINT, PROJECT_ROOT, tool
from policy_gate import governance_problems
from toolchain import lizard_command

OK, BAD, TODO = 'OK  ', 'FIX ', 'TODO'


def git_state(root: Path) -> list[tuple[str, str]]:
    if not shutil.which('git'):
        return [(BAD, 'git is not installed')]
    inside = subprocess.run(['git', '-C', str(root), 'rev-parse', '--is-inside-work-tree'],
                            capture_output=True, text=True, check=False).stdout.strip()
    if inside != 'true':
        return [(TODO, 'not a git repository yet: git init (Phase ZERO does it)')]
    hooks = subprocess.run(['git', '-C', str(root), 'config', 'core.hooksPath'],
                           capture_output=True, text=True, check=False).stdout.strip()
    return [(OK, 'git repository'),
            (OK, 'git hooks active') if hooks == '.githooks' else
            (TODO, f'git hooks inactive: python3 {tool("genesis.py")} hooks')]


def kit_tools() -> list[tuple[str, str]]:
    version_ok = sys.version_info >= (3, 9)
    lizard = lizard_command() is not None
    return [(OK if version_ok else BAD, f'Python {sys.version.split()[0]} (3.9+ needed)'),
            (OK, 'lizard (function length/complexity for 25+ languages)') if lizard else
            (BAD, f'lizard missing: python3 {tool("genesis.py")} setup')]


def manifest_state(root: Path) -> tuple[list[tuple[str, str]], dict | None]:
    try:
        manifest = load_manifest(root, require_ready=False)
    except ManifestError as exc:
        return [(BAD, f'engineering.json: {exc}')], None
    name, ready = manifest.get('project'), manifest.get('ready') is True
    rows = [(OK if name not in (None, '', 'CONFIGURE_ME') else TODO, f'project name: {name}'),
            (OK if ready else TODO, 'ready=true (owner approved)' if ready else
             'ready=false: expected until every gate is proven and the owner approves')]
    return rows, manifest


def _proven(root: Path, name: str, commands: list, ledger: dict) -> bool:
    slots = [prove.slot(name, i, len(commands)) for i in range(1, len(commands) + 1)]
    return all(ledger.get(folder, {}).get('sha') == prove.digest(command, root, folder)
               for folder, command in zip(slots, commands))


def gate_state(root: Path, manifest: dict) -> list[tuple[str, str]]:
    checks = manifest.get('checks', {})
    configured = [n for n in FULL if _configured(n, checks.get(n))]
    ledger = prove.read_ledger(root)
    proven = [n for n in configured if _proven(root, n, commands_of(checks[n]), ledger)]
    missing = [n for n in FULL if n not in configured]
    return [_count_row('gates configured', len(configured), len(FULL), missing),
            _count_row('gates proven red->green', len(proven), len(configured), [])]


def _count_row(label: str, done: int, total: int, missing: list[str]) -> tuple[str, str]:
    detail = f' (missing: {", ".join(missing)})' if missing else ''
    return (OK if total and done == total else TODO), f'{label} {done}/{total}{detail}'


def _configured(name: str, value) -> bool:
    return all(command_problem(name, command) is None for command in commands_of(value))


def blueprint_row(root: Path) -> tuple[str, str]:
    blueprint = root / BLUEPRINT
    if not blueprint.is_file():
        return BAD, f'{BLUEPRINT} missing'
    fills = blueprint.read_text(encoding='utf-8').count('[fill]')
    if fills:
        return TODO, f'{BLUEPRINT}: {fills} [fill] left (filled during Phase ONE)'
    return OK, f'{BLUEPRINT} filled'


def leftover_rows(root: Path) -> list[tuple[str, str]]:
    found = [p for pattern in ('*.genesis-new', '*.recipe-new') for p in root.rglob(pattern)]
    return [(BAD, f'unmerged kit file: {p.relative_to(root).as_posix()}')
            for p in sorted(found) if '.git' not in p.parts]


def owners_row(root: Path) -> tuple[str, str]:
    owners = governance_problems(root)
    if not owners:
        return OK, 'CODEOWNERS owns every policy path'
    if all('CONFIGURE_ME' in problem for problem in owners):
        return TODO, 'CODEOWNERS: put the owner handle instead of @CONFIGURE_ME'
    return BAD, owners[0]


def project_state(root: Path) -> list[tuple[str, str]]:
    claude = (root / '.claude' / 'settings.json').is_file()
    hooks = (OK, 'Claude Code hooks configured') if claude else (BAD, '.claude/settings.json missing')
    return [blueprint_row(root)] + leftover_rows(root) + [owners_row(root), hooks]


def skills_state(root: Path) -> list[tuple[str, str]]:
    done = subprocess.run([sys.executable, skills_policy.__file__, '--check', '--root', str(root)],
                          capture_output=True, text=True, check=False)
    lines = (done.stdout + done.stderr).strip().splitlines()
    return [(OK if done.returncode == 0 else BAD, lines[-1] if lines else 'skills check failed')]


def report(root: Path) -> list[tuple[str, str]]:
    rows = kit_tools() + git_state(root)
    manifest_rows, manifest = manifest_state(root)
    rows += manifest_rows + (gate_state(root, manifest) if manifest else [])
    return rows + project_state(root) + skills_state(root)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=PROJECT_ROOT)
    rows = report(parser.parse_args(argv).root.resolve())
    for status, text in rows:
        print(f'[{status}] {text}')
    broken = [text for status, text in rows if status == BAD]
    pending = [text for status, text in rows if status == TODO]
    print(f'\nNEXT: {(broken or pending or ["nothing pending"])[0]}')
    return 1 if broken else 0


if __name__ == '__main__':
    raise SystemExit(main())
