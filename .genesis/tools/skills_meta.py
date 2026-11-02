"""Reading and rewriting skill metadata for Claude Code and Codex copies."""
from __future__ import annotations

import re
from pathlib import Path

from layout import SKILL_HOMES as HOMES
from side_effects import SKILL_SENSITIVE
from skill_config import claude_locked, codex_locked, set_claude, set_codex

NAME = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
SENSITIVE = SKILL_SENSITIVE  # operations a model must never start because a skill said so


def skill_dirs(root: Path) -> dict[str, list[Path]]:
    found: dict[str, list[Path]] = {}
    for home in HOMES:
        base = root / home
        if base.is_dir():
            found[home] = [entry for entry in sorted(base.iterdir())
                           if (entry / 'SKILL.md').is_file()]
    return found


def frontmatter(text: str) -> dict[str, str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != '---':
        return {}
    fields = {}
    for line in lines[1:]:
        if line.strip() == '---':
            return fields
        if line[:1].isalpha() and ':' in line:
            key, value = line.split(':', 1)
            fields[key.strip()] = value.strip().strip('"\'')
    return {}


def claude_invocable(skill: Path) -> bool:
    return not claude_locked((skill / 'SKILL.md').read_text(encoding='utf-8'))


def codex_invocable(skill: Path) -> bool:
    """Codex default is implicit invocation allowed unless policy says false."""
    config = skill / 'agents' / 'openai.yaml'
    return not (config.is_file() and codex_locked(config.read_text(encoding='utf-8')))


def open_clients(skill: Path) -> list[str]:
    """Clients in which the model may start this skill on its own (checked separately)."""
    return [client for client, is_open in (('Claude', claude_invocable(skill)),
                                           ('Codex', codex_invocable(skill))) if is_open]


def skill_problems(skill: Path) -> list[str]:
    meta, label = frontmatter((skill / 'SKILL.md').read_text(encoding='utf-8')), skill.as_posix()
    if not meta:
        return [f'{label}: SKILL.md needs YAML frontmatter with name and description']
    problems = []
    name = meta.get('name', '')
    if not NAME.match(name) or len(name) > 64 or name != skill.name:
        problems.append(f'{label}: name must be lowercase-hyphenated, <=64 chars, = folder name')
    if not meta.get('description') or len(meta['description']) > 1024:
        problems.append(f'{label}: description required, <=1024 chars')
    return problems


def classify_problems(skill: Path, rules: dict[str, set[str]]) -> list[str]:
    name, label = skill.name, skill.as_posix()
    if name in rules['model_invocable']:
        return _invocable_problems(skill, label)
    if name in rules['user_only']:
        unlocked = open_clients(skill)
        return [f'{label}: explicit-only by policy but still model-invocable in {c}; run --apply'
                for c in unlocked]
    return [f'{label}: unclassified skill; add it to engineering.json skills.model_invocable '
            '(safe, callable by name) or skills.user_only (side effects, slash only)']


def _invocable_problems(skill: Path, label: str) -> list[str]:
    problems = [f'{label}: {name} is binary or not UTF-8 text; it cannot be inspected, so the '
                'skill must be user_only' for name in unreadable(skill)]
    hit = SENSITIVE.search(skill_text(skill))
    if hit:
        problems.append(f'{label}: contains "{hit.group(0)}"; a skill with side effects must be '
                        'user_only')
    if problems:
        return problems
    locked = {'Claude', 'Codex'} - set(open_clients(skill))
    return [f'{label}: should be callable by name but is locked in {c}; run --apply'
            for c in sorted(locked)]


def skill_files(skill: Path) -> list[Path]:
    return [p for p in sorted(skill.rglob('*')) if p.is_file()]


def unreadable(skill: Path) -> list[str]:
    bad = []
    for path in skill_files(skill):
        try:
            data = path.read_bytes()
            data.decode('utf-8')
        except (OSError, UnicodeDecodeError):
            bad.append(path.relative_to(skill).as_posix())
            continue
        if b'\0' in data:
            bad.append(path.relative_to(skill).as_posix())
    return bad


def skill_text(skill: Path) -> str:
    """Every file of the skill (scripts in any language included), not just Markdown."""
    return '\n'.join(p.read_text(encoding='utf-8', errors='replace') for p in skill_files(skill))


def sync_problems(found: dict[str, list[Path]]) -> list[str]:
    """Both agent homes must hold the same skills with identical files."""
    if len(found) < 2:
        return []
    claude = {p.name: p for p in found.get(HOMES[0], [])}
    codex = {p.name: p for p in found.get(HOMES[1], [])}
    problems = [f'{name}: installed for only one agent; run: python3 .genesis/tools/genesis.py '
                'skills --sync'
                for name in sorted(set(claude) ^ set(codex))]
    for name in sorted(set(claude) & set(codex)):
        if _tree(claude[name]) != _tree(codex[name]):
            problems.append(f'{name}: files differ between {HOMES[0]} and {HOMES[1]}; edit '
                            f'{HOMES[1]} only, then run genesis.py skills --sync')
    return problems


def _tree(folder: Path) -> dict[str, bytes]:
    return {p.relative_to(folder).as_posix(): p.read_bytes()
            for p in folder.rglob('*') if p.is_file()}


def set_mode(skill: Path, invocable: bool) -> int:
    """Rewrite Claude frontmatter and Codex policy; returns number of files changed."""
    return _set_claude(skill / 'SKILL.md', invocable) + _set_codex(skill, invocable)


def _set_claude(manifest: Path, invocable: bool) -> int:
    text = manifest.read_text(encoding='utf-8')
    if claude_locked(text) == (not invocable):
        return 0
    manifest.write_text(set_claude(text, lock=not invocable), encoding='utf-8')
    return 1


def _set_codex(skill: Path, invocable: bool) -> int:
    config = skill / 'agents' / 'openai.yaml'
    text = config.read_text(encoding='utf-8') if config.is_file() else ''
    if codex_locked(text) == (not invocable):
        return 0
    config.parent.mkdir(exist_ok=True)
    config.write_text(set_codex(text, lock=not invocable), encoding='utf-8')
    return 1
