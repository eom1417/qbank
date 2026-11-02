"""Where everything of the kit lives. The single owner of kit paths.

The kit keeps all of its own files under `.genesis/` so a project keeps `docs/`, `tools/`,
`prompts/`, `scripts/` and every other common folder name for itself.
"""
from __future__ import annotations

from pathlib import Path

KIT = '.genesis'
TOOLS_DIR = f'{KIT}/tools'
DOCS_DIR = f'{KIT}/docs'
PROOF_DIR = f'{KIT}/proofs/'
RECIPE_DIR = f'{KIT}/recipes/'
LEDGER = f'{KIT}/proofs.json'
JOURNAL = f'{KIT}/proof-journal.json'
BACKUP_DIR = f'{KIT}/backup'
PYLIB = f'{KIT}/.pylib'
MANIFEST = 'engineering.json'
BLUEPRINT = 'BLUEPRINT.md'

# The project that contains this kit (tools live at <project>/.genesis/tools).
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# One authored source of project skills; the Claude copy is a mirror (symlink or exact copy).
SKILL_SOURCE = '.agents/skills'
SKILL_MIRROR = '.claude/skills'
SKILL_HOMES = (SKILL_MIRROR, SKILL_SOURCE)

# Kit-owned scratch that never reaches git (see .gitignore).
SCRATCH = (PYLIB, JOURNAL, BACKUP_DIR)


def tool(name: str) -> str:
    """Repository-relative path of a kit script, e.g. tool('guard.py')."""
    return f'{TOOLS_DIR}/{name}'
