"""One authored skill source (.agents/skills) and its Claude mirror (.claude/skills).

  sync(root)          make .claude/skills an exact copy of .agents/skills; skills that an
                      installer put only into .claude/skills are adopted into the source first
  install_user(kit)   put the `genesis-start` skill into the user's own skill folders, so
                      "ابدأ مشروع جديد" / "start a new project" works in any folder, by name
"""
from __future__ import annotations

import filecmp
import shutil
from pathlib import Path

from layout import SKILL_MIRROR, SKILL_SOURCE, tool

USER_HOMES = ('.claude/skills', '.agents/skills')
START_SKILL = 'genesis-start'


def sync(root: Path, adopt: bool = True) -> list[str]:
    """Make the mirror equal the source; returns notes about what the mirror lost or gave.
    The source always wins (edit skills in .agents/skills only); adopt=False skips adoption."""
    source, mirror = root / SKILL_SOURCE, root / SKILL_MIRROR
    if mirror.is_symlink():
        same = mirror.resolve() == source.resolve()
        if not same:
            raise ValueError(f'{SKILL_MIRROR} is a symlink to somewhere else; remove it')
        return []
    source.mkdir(parents=True, exist_ok=True)
    notes = _adopt(source, mirror) if adopt and mirror.is_dir() else []
    if mirror.exists():
        shutil.rmtree(mirror)
    shutil.copytree(source, mirror)
    return notes


def _adopt(source: Path, mirror: Path) -> list[str]:
    """Skills present only in the mirror move to the source; for twins the source wins."""
    notes = []
    for skill in sorted(p for p in mirror.iterdir() if (p / 'SKILL.md').is_file()):
        twin = source / skill.name
        if not twin.exists():
            shutil.copytree(skill, twin)
            notes.append(f'{skill.name}: adopted from {SKILL_MIRROR} into {SKILL_SOURCE}')
        elif _differs(skill, twin):
            notes.append(f'{skill.name}: {SKILL_MIRROR} copy differed and was replaced by '
                         f'{SKILL_SOURCE} (edit skills there only; old copy is in git history)')
    return notes


def _differs(left: Path, right: Path) -> bool:
    files = {p.relative_to(left).as_posix() for p in left.rglob('*') if p.is_file()}
    files |= {p.relative_to(right).as_posix() for p in right.rglob('*') if p.is_file()}
    return any(not ((left / f).is_file() and (right / f).is_file()
                    and filecmp.cmp(left / f, right / f, shallow=False)) for f in files)


def start_skill(kit: Path) -> str:
    """SKILL.md for the user-level entry skill, pointing at this kit copy."""
    installer = kit / tool('genesis.py')
    return f'''---
name: {START_SKILL}
description: Start or adopt a project on the Project Genesis foundation (hard 400/50/10 limits, proven guards, one owner per concern). Use when the user wants to start a new project, bootstrap a repository, or apply Genesis to an existing one ("ابدأ مشروع جديد", "أسس مشروع", "جهز البنية", "طبق Genesis", "start a new project", "bootstrap this repo").
---

# {START_SKILL}

1. Confirm the target folder with the user (default: the current working directory).
2. Run `python3 "{installer}" install --into <target>`. It never overwrites a file:
   conflicts are written as `<file>.genesis-new` and listed for a careful merge.
3. Continue inside the target: read its `START_HERE.md` and follow Phase ZERO (no idea yet)
   or Phase ONE (the user described the product). For an existing codebase, Phase ONE uses
   `.genesis/prompts/05_ADOPT_EXISTING.md`.

Never delete or reset files in the target. If the kit path above no longer exists, ask the
user for the Project Genesis folder or ZIP instead of guessing.
'''


def install_user(kit: Path, home: Path) -> list[str]:
    """Write genesis-start into every user skill home; returns the written paths."""
    written = []
    for rel in USER_HOMES:
        target = home / rel / START_SKILL / 'SKILL.md'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(start_skill(kit), encoding='utf-8')
        written.append(str(target))
    return written
