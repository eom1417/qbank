#!/usr/bin/env python3
"""Fail-closed quality gate runner driven by engineering.json.

  check.py               fast gates (edit loop)
  check.py --full        PR gate
  check.py --release     release gate
  check.py --only lint   targeted gate(s); built-ins always run first
  check.py --full --prove   also plant each gate's fixture and require red (CI does this)
  check.py --hook pre-commit|pre-push   used by .githooks
Every configured gate must have a recorded proof (.genesis/proofs.json) matching its
current command and fixture, otherwise it is reported as unproven.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import prove
import proof_semantics
import regen
from policy_gate import governance_problems
from guard_core import PROBE_SUFFIX, ManifestError, load_manifest, read_manifest
from layout import JOURNAL, LEDGER, PROJECT_ROOT, PROOF_DIR

TOOLS = Path(__file__).resolve().parent
FAST = ('architecture', 'function_length', 'complexity', 'format', 'lint', 'types')
FULL = FAST + ('unit', 'contracts', 'duplication', 'dead_code', 'security', 'dependencies',
                'build')
EXTRA = ('design', 'integration', 'e2e', 'operations')
NOOP = {'echo', 'true', ':', 'printf', 'exit', 'pass', 'yes', 'sleep', 'false'}
INLINE = {'-c', '-e', '--eval', '-p', '--print', '-Command', '-command', '/c'}
INTERPRETERS = ('python', 'node', 'bash', 'sh', 'zsh', 'ruby', 'perl', 'pwsh',
                'powershell', 'cmd', 'deno', 'bun')
PLACEHOLDERS = ('TODO', 'REPLACE', 'CONFIGURE_ME', 'FIXME')
# Language-neutral kit guards that run before every configured gate (proven by the self-tests).
BUILTINS = (('authored-file-limits', 'guard.py', []),
            ('copy-paste', 'duplication.py', []),
            ('design-tokens', 'design_guard.py', []),
            ('agent-skills', 'skills_policy.py', ['--check']))


def commands_of(value) -> list[list[str]]:
    """A gate is one argv list or a list of argv lists (multi-language)."""
    if isinstance(value, list) and value and all(isinstance(v, list) for v in value):
        return value
    return [value]


def command_problem(name: str, command) -> str | None:
    if not isinstance(command, list) or not command:
        return f'{name}: no command configured'
    if not all(isinstance(arg, str) and arg.strip() for arg in command):
        return f'{name}: command must be a non-empty string array'
    return _text_problem(name, ' '.join(command)) or _fake_gate_problem(name, _strip_env(command))


def _text_problem(name: str, text: str) -> str | None:
    if any(marker in text.upper() for marker in PLACEHOLDERS):
        return f'{name}: placeholder command'
    if any(token in text for token in (PROOF_DIR.rstrip('/'), PROBE_SUFFIX, LEDGER, JOURNAL)):
        return f'{name}: a gate may not reference proof fixtures or the proof ledger'
    return None


def _fake_gate_problem(name: str, argv: list[str]) -> str | None:
    program = Path(argv[0]).name.lower() if argv else ''
    if program in NOOP or not program:
        return f'{name}: no-op command cannot certify a gate'
    if program.startswith(INTERPRETERS) and argv[1:2] and argv[1] in INLINE:
        return f'{name}: inline one-liner cannot certify a gate; call a reviewed script'
    return None


def _strip_env(command: list[str]) -> list[str]:
    argv = list(command)
    if argv and Path(argv[0]).name == 'env':
        argv = argv[1:]
    while argv and '=' in argv[0] and not argv[0].startswith('-'):
        argv = argv[1:]
    return argv


def gate_names(manifest: dict, level: str, only: list[str] | None) -> list[str]:
    if only:
        return list(dict.fromkeys(only))
    names = list(FAST if level == 'fast' else FULL)
    applies = manifest.get('applies', {})
    return names + [name for name in EXTRA
                    if applies.get(name) is True and _extra_wanted(manifest, name, level)]


def _extra_wanted(manifest: dict, name: str, level: str) -> bool:
    """design runs at every level (the built-in token guard covers it when no stack command
    is configured); integration/e2e from full; operations only at release."""
    if name == 'design':
        return bool(manifest.get('checks', {}).get('design'))
    return level == 'release' or (level == 'full' and name in ('integration', 'e2e'))


def run(name: str, cmd: list[str], root: Path) -> bool:
    print(f'GATE {name}: {" ".join(cmd)}', flush=True)
    try:
        code = subprocess.run(cmd, cwd=root, check=False).returncode
    except OSError as exc:
        print(f'FAIL {name}: BLOCKED, cannot run command: {exc}', flush=True)
        return False
    if code:
        print(f'FAIL {name}: exit {code}', flush=True)
    return code == 0


def builtin_gates(root: Path) -> list[tuple[str, list[str], None]]:
    py = sys.executable
    return [(name, [py, str(TOOLS / script), *extra, '--root', str(root)], None)
            for name, script, extra in BUILTINS]


def planned(manifest: dict, names: list[str], root: Path) -> tuple[list, list[str]]:
    """(gate, argv, proof folder) for every command; built-ins are proven by self-tests."""
    checks = manifest.get('checks')
    if not isinstance(checks, dict):
        return [], ['checks must map gate names to command arrays']
    plan, problems = builtin_gates(root), []
    for name in names:
        commands = commands_of(checks.get(name))
        for index, command in enumerate(commands, start=1):
            problem = command_problem(name, command)
            if problem:
                problems.append(problem)
            else:
                plan.append((name, command, prove.slot(name, index, len(commands))))
    return plan, problems


def execute(plan: list, root: Path) -> bool:
    done = set()
    for name, command, _ in plan:
        key = tuple(command)
        if key in done:
            print(f'REUSED {name}: identical command already passed', flush=True)
            continue
        if not run(name, command, root):
            return False
        done.add(key)
    return True


def prove_all(plan: list, root: Path, manifest: dict) -> bool:
    problems = prove.language_problems(root, manifest)
    results = {}
    for name, command, folder in plan:
        if folder is None:
            continue
        ok, detail = prove.prove(root, name, command, folder)
        print(f'{"PROVED" if ok else "UNPROVEN"} {name} [{folder}]: {detail}', flush=True)
        if ok:
            results[folder] = prove.entry(command, root, folder)
        else:
            problems.append(f'{name}: {detail}')
    for problem in problems:
        print(f'FAIL: {problem}')
    if not problems:
        prove.record(root, results)
    return not problems


def gate(root: Path, level: str, only: list[str] | None, proving: bool = False) -> int:
    if prove.restore(root):
        print('RECOVERED: removed proof fixtures left by an interrupted run')
    try:
        manifest = load_manifest(root, require_ready=not proving)
    except ManifestError as exc:
        print(f'FAIL: {exc}')
        return 1
    plan, problems = planned(manifest, gate_names(manifest, level, only), root)
    problems += governance_problems(root) + proof_semantics.command_problems(plan)
    if not proving:
        problems += prove.ledger_problems(root, plan)
    for problem in problems:
        print(f'FAIL: {problem}')
    if problems or not _run_all(plan, root, manifest, level != 'fast' and not only, proving):
        return 1
    scope = ', '.join(only) if only else level
    print(f'PASS: {scope} gates ran green and every one is proven to fail on its fixture')
    if manifest.get('ready') is not True:
        print('NEXT: every gate is proven; the owner may now set "ready": true')
    return 0


def _run_all(plan: list, root: Path, manifest: dict, regen: bool, proving: bool) -> bool:
    if not execute(plan, root):
        return False
    if regen and not _generated_ok(root, manifest):
        return False
    return prove_all(plan, root, manifest) if proving else True


def _generated_ok(root: Path, manifest: dict) -> bool:
    problems = regen.verify_generated(root, manifest)
    for problem in problems:
        print(f'FAIL: {problem}')
    return not problems


def hook(root: Path, name: str) -> int:
    """Before bootstrap, hooks run only what already works; afterwards the real gates."""
    try:
        ready = read_manifest(root).get('ready') is True
    except ManifestError:
        ready = False
    if ready:
        return gate(root, 'fast' if name == 'pre-commit' else 'full', None)
    if name == 'pre-push':
        tests = [sys.executable, '-m', 'unittest', 'discover', '-s', str(TOOLS), '-p', 'test_*.py']
        return 0 if run('kit-self-tests', tests, root) else 1
    staged = subprocess.run(['git', '-C', str(root), 'diff', '--cached', '--name-only',
                             '--diff-filter=ACMR', '-z'], capture_output=True, check=False)
    files = [str(root / f) for f in staged.stdout.decode().split('\0') if f]
    if not files:
        return 0
    return 0 if run('staged-files', [sys.executable, str(TOOLS / 'guard.py'),
                                     '--root', str(root), '--files', *files], root) else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--full', action='store_true')
    parser.add_argument('--release', action='store_true')
    parser.add_argument('--only', action='append', choices=FULL + EXTRA)
    parser.add_argument('--prove', action='store_true')
    parser.add_argument('--hook', choices=('pre-commit', 'pre-push'))
    parser.add_argument('--root', type=Path, default=PROJECT_ROOT)
    args = parser.parse_args(argv)
    root = args.root.resolve()
    if args.hook:
        return hook(root, args.hook)
    level = 'release' if args.release else ('full' if args.full else 'fast')
    return gate(root, level, args.only, args.prove)


if __name__ == '__main__':
    raise SystemExit(main())
