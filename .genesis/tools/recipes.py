"""Apply a proven stack recipe (.genesis/recipes/<name>): configs, proof fixtures, gates.

Never overwrites an existing project file (writes <file>.recipe-new instead) and never
replaces a gate that is already configured. Placeholders: __PKG__, __MODULE__.
"""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

from layout import MANIFEST, PROOF_DIR, RECIPE_DIR, tool
from manifest_io import write_manifest

RECIPES = RECIPE_DIR.rstrip('/')
KIT_DEFAULT = ['python3', tool('guard.py'), '--functions']
PLACEHOLDER = re.compile(r'__[A-Z]+__')


def module_from_go_mod(root: Path) -> dict[str, str]:
    try:
        first = (root / 'go.mod').read_text(encoding='utf-8').splitlines()[0]
    except (OSError, IndexError):
        return {}
    return {'MODULE': first.removeprefix('module').strip()}


def fill(text: str, variables: dict[str, str]) -> str:
    for key, value in variables.items():
        text = text.replace(f'__{key}__', value)
    return text


def apply(root: Path, name: str, variables: dict[str, str]) -> list[str]:
    source = root / RECIPES / name
    if not (source / 'recipe.json').is_file():
        return [f'unknown recipe {name!r}; available: {", ".join(available(root))}']
    variables = {**module_from_go_mod(root), **variables}
    recipe = json.loads(fill((source / 'recipe.json').read_text(encoding='utf-8'), variables))
    problems = [f'unfilled placeholder {m} (pass --var KEY=VALUE)'
                for m in sorted(set(PLACEHOLDER.findall(json.dumps(recipe))))]
    if problems:
        return problems
    _move_kit_fixtures(root, source)
    notes = [_copy(root, path, path.relative_to(source).as_posix(), variables)
             for path in sorted(source.rglob('*')) if path.is_file() and path.name != 'recipe.json']
    return [n for n in notes if n] + _merge_manifest(root, recipe)


def available(root: Path) -> list[str]:
    return sorted(p.parent.name for p in (root / RECIPES).glob('*/recipe.json'))


def _copy(root: Path, path: Path, rel: str, variables: dict[str, str]) -> str | None:
    rel = fill(rel.removesuffix('.recipe'), variables)
    if rel.startswith('proofs/'):
        rel = PROOF_DIR + rel.removeprefix('proofs/')
    text = fill(path.read_text(encoding='utf-8'), variables)
    leftover = PLACEHOLDER.search(rel + text)
    if leftover:
        return f'{rel}: unfilled placeholder {leftover.group(0)} (pass --var)'
    target = root / rel
    if target.exists() and target.read_text(encoding='utf-8') != text:
        target = target.with_name(target.name + '.recipe-new')
        note = f'{rel} exists: merge {target.name} by hand, then delete it'
    else:
        note = None
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding='utf-8')
    return note


def _move_kit_fixtures(root: Path, source: Path) -> None:
    """Multi-command gates use numbered proof folders; kit fixtures go with command 1."""
    for gate_dir in (source / 'proofs').glob('*'):
        kit = root / PROOF_DIR / gate_dir.name / 'probe_kit'
        if (gate_dir / '1').is_dir() and kit.is_dir():
            (kit.parent / '1').mkdir(exist_ok=True)
            shutil.move(str(kit), str(kit.parent / '1' / 'probe_kit'))


def _merge_manifest(root: Path, recipe: dict) -> list[str]:
    path = root / MANIFEST
    manifest = json.loads(path.read_text(encoding='utf-8'))
    kept = []
    checks = manifest.setdefault('checks', {})
    for gate, command in recipe.get('checks', {}).items():
        if checks.get(gate) and checks[gate] not in (command, KIT_DEFAULT):
            kept.append(f'{gate}: kept the existing command (recipe suggests {command})')
        else:
            checks[gate] = command
    if not manifest.get('setup'):
        manifest['setup'] = recipe.get('setup', [])
    write_manifest(root, manifest)
    return kept
