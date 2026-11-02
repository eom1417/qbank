#!/usr/bin/env python3
"""Skill invocation policy: safe skills callable by name (no slash), risky ones explicit-only.

  skills_policy.py --check   every installed skill classified, state matches policy,
                             no model-invocable skill runs deploy/merge/delete commands,
                             .claude/skills and .agents/skills identical (all files)
  skills_policy.py --apply   enforce engineering.json "skills" policy on installed copies
  skills_policy.py --index   name -> purpose table for the blueprint
  skills_policy.py --sync    copy .agents/skills (the one source) to the .claude/skills mirror
  skills_policy.py --install-user   add `genesis-start` to the user's own skill folders
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import skill_sync
from layout import MANIFEST, PROJECT_ROOT, SKILL_MIRROR, SKILL_SOURCE

from skills_meta import (HOMES, SENSITIVE, skill_text, classify_problems, frontmatter, set_mode,
                         skill_dirs, skill_problems, sync_problems)

ROOT = PROJECT_ROOT


def policy(root: Path) -> dict[str, set[str]]:
    try:
        data = json.loads((root / MANIFEST).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        data = {}
    skills = data.get('skills', {}) if isinstance(data, dict) else {}
    return {key: set(skills.get(key, [])) for key in ('required', 'model_invocable', 'user_only')}


def check(root: Path) -> int:
    found, rules = skill_dirs(root), policy(root)
    problems = sync_problems(found) + required_problems(found, rules)
    for skills in found.values():
        for skill in skills:
            problems += skill_problems(skill) + classify_problems(skill, rules)
    for problem in problems:
        print(f'FAIL: {problem}', file=sys.stderr)
    if problems:
        print(f'FAIL: {len(problems)} skill issue(s)')
        return 1
    print(summary(found, rules))
    return 0


def required_problems(found: dict, rules: dict[str, set[str]]) -> list[str]:
    """Required skills must exist for every agent; optional ones may be absent."""
    problems = [f'required skill {name} must also be in model_invocable'
                for name in sorted(rules['required'] - rules['model_invocable'])]
    for home in HOMES:
        present = {p.name for p in found.get(home, [])}
        problems += [f'required skill {name} is not installed in {home}'
                     for name in sorted(rules['required'] - present)]
    return problems


def summary(found: dict, rules: dict[str, set[str]]) -> str:
    names = {p.name for skills in found.values() for p in skills}
    optional = names - rules['required']
    callable_now = len(optional & rules['model_invocable'])
    explicit_now = len(optional & rules['user_only'])
    return (f'PASS: required {len(rules["required"] & names)}/{len(rules["required"])} installed '
            f'for {len(found)} agent home(s); optional installed: {callable_now} callable by name, '
            f'{explicit_now} explicit-only')


def apply(root: Path) -> int:
    """Lock/unlock the single source, then refresh the mirror from it."""
    try:
        notes = skill_sync.sync(root)
    except ValueError as exc:
        print(f'FAIL: {exc}', file=sys.stderr)
        return 1
    rules, changed = policy(root), 0
    for skill in skill_dirs(root).get(SKILL_SOURCE, []):
        if skill.name in rules['user_only']:
            changed += set_mode(skill, invocable=False)
        elif skill.name in rules['model_invocable'] and not SENSITIVE.search(skill_text(skill)):
            changed += set_mode(skill, invocable=True)
    skill_sync.sync(root, adopt=False)
    for note in notes:
        print(f'NOTE: {note}')
    print(f'APPLIED: {changed} file(s) changed; re-run after every skills install or update')
    return check(root)


def sync(root: Path) -> int:
    try:
        notes = skill_sync.sync(root)
    except ValueError as exc:
        print(f'FAIL: {exc}', file=sys.stderr)
        return 1
    for note in notes:
        print(f'NOTE: {note}')
    print(f'PASS: {SKILL_MIRROR} mirrors {SKILL_SOURCE}')
    return 0


def install_user() -> int:
    for path in skill_sync.install_user(PROJECT_ROOT, Path.home()):
        print(f'INSTALLED: {path}')
    print('Say "start a new project" / "ابدأ مشروع جديد" in any folder; no slash needed.')
    return 0


def index(root: Path) -> int:
    rules = policy(root)
    print('| Skill | How to call | Use it when |\n|---|---|---|')
    seen = set()
    for skills in skill_dirs(root).values():
        for skill in skills:
            if skill.name in seen:
                continue
            seen.add(skill.name)
            meta = frontmatter((skill / 'SKILL.md').read_text(encoding='utf-8'))
            how = 'say its name' if skill.name in rules['model_invocable'] else f'/{skill.name}'
            print(f'| `{skill.name}` | {how} | {meta.get("description", "")[:140]} |')
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--index', action='store_true')
    mode.add_argument('--sync', action='store_true')
    mode.add_argument('--install-user', action='store_true')
    parser.add_argument('--root', type=Path, default=ROOT)
    args = parser.parse_args(argv)
    root = args.root.resolve()
    actions = {'apply': apply, 'sync': sync, 'index': index}
    if args.install_user:
        return install_user()
    chosen = next((name for name in actions if getattr(args, name)), None)
    return actions[chosen](root) if chosen else check(root)


if __name__ == '__main__':
    raise SystemExit(main())
