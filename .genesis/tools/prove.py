"""Executable negative proofs: a gate counts only after it was seen failing.

Fixtures live in .genesis/proofs/<gate>/ (or .genesis/proofs/<gate>/<n>/ for the n-th
command of a multi-command gate) as files ending in `.probe`; the path below that folder is
where the fixture is planted. A proof passes only when, with the fixture planted,
the gate exits non-zero AND its output names a planted file. The working tree is
always restored; an interrupted run is recovered on the next check.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import tempfile
from datetime import date
from pathlib import Path

import proof_semantics
from guard_core import PROBE_SUFFIX, collect
from guard_rules import has_functions, suffix_of
from layout import BACKUP_DIR, JOURNAL, KIT, LEDGER, MANIFEST, PROOF_DIR, tool

FORBIDDEN_TARGETS = ('.git/', '.github/', f'{KIT}/', '.claude/', '.agents/', '.githooks/',
                     MANIFEST)
PER_LANGUAGE = ('function_length', 'complexity')


def slot(name: str, index: int, total: int) -> str:
    return f'{PROOF_DIR}{name}' if total == 1 else f'{PROOF_DIR}{name}/{index}'


def fixtures(root: Path, folder: str) -> list[tuple[Path, str]]:
    base = root / folder
    if not base.is_dir():
        return []
    return [(path, path.relative_to(base).as_posix()[:-len(PROBE_SUFFIX)])
            for path in sorted(base.rglob('*' + PROBE_SUFFIX))]


def fixture_problems(folder: str, items: list[tuple[Path, str]]) -> list[str]:
    if not items:
        return [f'{folder}: no proof fixture (*.probe); this gate has never been seen failing']
    problems = [f'{folder}: fixture may not target {target}' for _, target in items
                if target.startswith(FORBIDDEN_TARGETS) or '..' in target.split('/')]
    return problems + ignored_fixtures(folder, [path for path, _ in items])


def ignored_fixtures(folder: str, paths: list[Path]) -> list[str]:
    """A git-ignored fixture proves locally but never reaches CI or a fresh clone."""
    if not paths:
        return []
    done = subprocess.run(['git', '-C', str(paths[0].parent), 'check-ignore', '--no-index',
                           *map(str, paths)], capture_output=True, text=True, check=False)
    return [f'{folder}: fixture {Path(line).name} is git-ignored; CI would never see it'
            for line in done.stdout.splitlines() if line.strip()]


def digest(command: list[str], root: Path, folder: str) -> str:
    """Identity of a proof: the command, every fixture and the expected mention."""
    sha = hashlib.sha256(json.dumps(command).encode())
    for path, target in fixtures(root, folder):
        sha.update(target.encode() + b'\0' + path.read_bytes())
    expect = root / folder / 'expect.txt'
    if expect.is_file():
        sha.update(b'expect\0' + expect.read_bytes())
    return sha.hexdigest()


def read_ledger(root: Path) -> dict:
    try:
        data = json.loads((root / LEDGER).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def ledger_problems(root: Path, plan: list) -> list[str]:
    """Fast path: every configured gate must match a recorded successful proof."""
    ledger, problems = read_ledger(root), []
    for name, command, folder in plan:
        if folder is None:
            continue
        current = digest(command, root, folder)
        if ledger.get(folder, {}).get('sha') != current:
            problems.append(f'{name}: unproven since its command or fixture changed; '
                            f'run python3 {tool("genesis.py")} prove')
    return problems


def language_problems(root: Path, manifest: dict) -> list[str]:
    """Function gates need one planted violation per code language in the repo."""
    code = {suffix_of(rel) for rel in collect(root, manifest).owned
            if has_functions(rel, manifest['owned_extensions'])}
    problems = []
    for gate in PER_LANGUAGE:
        planted = {suffix_of(target) for folder in _gate_folders(root, gate)
                   for _, target in fixtures(root, folder)}
        problems += [f'{gate}: no proof fixture for {ext} files' for ext in sorted(code - planted)]
    return problems


def _gate_folders(root: Path, gate: str) -> list[str]:
    return [f'{PROOF_DIR}{gate}']


def prove(root: Path, name: str, command: list[str], folder: str) -> tuple[bool, str]:
    items = fixtures(root, folder)
    problems = fixture_problems(folder, items) or proof_semantics.fixture_kind_problems(name, items)
    if problems:
        return False, '; '.join(problems)
    done = _run_with(root, command, items)
    if isinstance(done, str):
        return False, done
    ok, detail = judge(done, needles(root, folder, [target for _, target in items]))
    if not ok:
        return False, detail
    return _control_passes(root, name, command, items)


def _run_with(root: Path, command: list[str], items: list[tuple[Path, str]]):
    plant(root, items)
    try:
        return subprocess.run(command, cwd=root, capture_output=True, text=True, check=False)
    except OSError as exc:
        return f'BLOCKED: {exc}'
    finally:
        restore(root)


def _control_passes(root: Path, name: str, command: list[str], items) -> tuple[bool, str]:
    """Same fixture with only the gate's own violation removed must turn the gate green."""
    with tempfile.TemporaryDirectory() as scratch:
        control = proof_semantics.control_items(name, items, Path(scratch))
        if control is None:
            return True, 'red as expected'
        done = _run_with(root, command, control)
    if isinstance(done, str):
        return False, done
    if done.returncode != 0:
        return False, (f'still fails with the {name} violation removed (exit {done.returncode}): '
                       f'it fails for something other than {name}')
    return True, f'red on the {name} violation, green without it'


def needles(root: Path, folder: str, targets: list[str]) -> list[str]:
    """What the failing output must mention: expect.txt lines, else the planted file stems."""
    expect = root / folder / 'expect.txt'
    if expect.is_file():
        lines = [line.strip() for line in expect.read_text(encoding='utf-8').splitlines()]
        return [line for line in lines if line]
    return [Path(t).stem for t in targets]


def judge(done, wanted: list[str]) -> tuple[bool, str]:
    output = done.stdout + done.stderr
    if done.returncode == 0:
        return False, 'gate still PASSES with the violation planted: it does not check this'
    if not any(word in output for word in wanted):
        return False, f'gate failed (exit {done.returncode}) without mentioning ' \
                      f'{", ".join(wanted)}: it failed for some other reason'
    return True, f'red as expected (exit {done.returncode})'


def plant(root: Path, items: list[tuple[Path, str]]) -> list[str]:
    journal = {'planted': [], 'backups': {}, 'dirs': []}
    backup_dir = root / BACKUP_DIR
    backup_dir.mkdir(parents=True, exist_ok=True)
    for index, (source, target) in enumerate(items):
        dest = root / target
        if dest.exists():
            copy = backup_dir / str(index)
            shutil.copy2(dest, copy)
            journal['backups'][target] = copy.relative_to(root).as_posix()
        journal['dirs'] += _missing_dirs(root, dest.parent)
        dest.parent.mkdir(parents=True, exist_ok=True)
        journal['planted'].append(target)
        _write_journal(root, journal)
        shutil.copy2(source, dest)
    return journal['planted']


def _missing_dirs(root: Path, folder: Path) -> list[str]:
    missing = []
    while not folder.exists() and folder != root:
        missing.append(folder.relative_to(root).as_posix())
        folder = folder.parent
    return missing


def _write_journal(root: Path, journal: dict) -> None:
    (root / JOURNAL).write_text(json.dumps(journal), encoding='utf-8')


def restore(root: Path) -> bool:
    """Undo planted fixtures; safe to call when nothing is planted."""
    path = root / JOURNAL
    if not path.exists():
        return False
    journal = json.loads(path.read_text(encoding='utf-8'))
    for target in journal.get('planted', []):
        backup = journal.get('backups', {}).get(target)
        if backup:
            shutil.copy2(root / backup, root / target)
        else:
            (root / target).unlink(missing_ok=True)
    for folder in sorted(journal.get('dirs', []), key=len, reverse=True):
        _remove_empty(root / folder)
    shutil.rmtree(root / BACKUP_DIR, ignore_errors=True)
    path.unlink()
    return True


def _remove_empty(folder: Path) -> None:
    try:
        folder.rmdir()
    except OSError:
        pass


def record(root: Path, results: dict) -> None:
    ledger = read_ledger(root)
    ledger.update(results)
    (root / KIT).mkdir(exist_ok=True)
    (root / LEDGER).write_text(json.dumps(ledger, indent=2, sort_keys=True) + '\n', encoding='utf-8')


def entry(command: list[str], root: Path, folder: str) -> dict:
    return {'sha': digest(command, root, folder), 'proved_on': date.today().isoformat()}
