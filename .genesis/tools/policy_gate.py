#!/usr/bin/env python3
"""Governance checks that do not trust the code under review.

  policy_gate.py --governance           CODEOWNERS exists and owns every policy path
  policy_gate.py --base REF --labels L  a PR touching policy paths needs the policy-change label
  policy_gate.py --base-guard REF       run the BASE branch's guard against this tree, so a PR
                                        cannot weaken the guard and pass by its own rules
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from guard_core import POLICY_PATHS, is_policy_path
from layout import PROJECT_ROOT, TOOLS_DIR

ROOT = PROJECT_ROOT
OWNERS_FILES = ('.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS', '.gitlab/CODEOWNERS')
# Real files that must resolve to a real owner under GitHub's CODEOWNERS rules.
SENSITIVE_SAMPLES = (
    'engineering.json', '.genesis/tools/guard.py', '.genesis/tools/check.py',
    '.genesis/proofs/lint/src/x.py.probe', '.genesis/proofs.json', '.github/workflows/quality.yml',
    '.github/CODEOWNERS', '.claude/settings.json', '.claude/skills/feature-delivery/SKILL.md',
    '.agents/skills/feature-delivery/SKILL.md', '.githooks/pre-commit', '.githooks/commit-msg',
    '.genesis/adapters/eslint.rules.mjs', '.genesis/recipes/python/recipe.json',
    'AGENTS.md', 'CLAUDE.md', 'START_HERE.md', '.genesis/docs/01_PRINCIPLES.md',
    '.genesis/prompts/01_BOOTSTRAP.md', 'skills-lock.json', '.claude/hooks/genesis-hook.sh',
)
# Real root config names that the POLICY_PATHS globs cover (regression set from review v6).
REAL_CONFIG_FILES = (
    'tsconfig.json', 'tsconfig.build.json', 'eslint.config.mjs', '.eslintrc.json', '.gitleaks.toml',
    'knip.config.ts', 'knip.json', 'biome.json', 'ruff.toml', '.golangci.yml', '.swiftlint.yml',
    'detekt.yml', '.dependency-cruiser.cjs', '.importlinter', '.jscpd.json', 'stylelint.config.mjs',
    '.stylelintrc.json', '.semgrep.yml', 'CODEOWNERS',
)
LABEL = 'policy-change'


def coverage_samples() -> tuple[str, ...]:
    """One concrete file per POLICY_PATHS category (so no category can be skipped),
    plus hand-picked real files. Every category of the label gate needs a code owner."""
    derived = tuple(pattern.replace('*', 'x') for pattern in POLICY_PATHS)
    return SENSITIVE_SAMPLES + REAL_CONFIG_FILES + derived


def governance_problems(root: Path) -> list[str]:
    found = [root / name for name in OWNERS_FILES if (root / name).is_file()]
    if not found:
        return ['no CODEOWNERS file: policy changes would not require owner review']
    rules = parse_codeowners(found[0].read_text(encoding='utf-8'))
    problems = []
    for sample in coverage_samples():
        owners = owners_of(sample, rules)
        if not owners:
            problems.append(f'CODEOWNERS gives no owner to {sample}')
        elif any('CONFIGURE_ME' in owner for owner in owners):
            problems.append(f'CODEOWNERS: replace @CONFIGURE_ME (owner of {sample})')
    return sorted(set(problems))


def parse_codeowners(text: str) -> list[tuple[re.Pattern, list[str]]]:
    rules = []
    for line in text.splitlines():
        parts = line.split('#', 1)[0].split()
        if parts:
            owners = [p for p in parts[1:] if p.startswith('@') or '@' in p]
            rules.append((pattern_regex(parts[0]), owners))
    return rules


def owners_of(path: str, rules: list[tuple[re.Pattern, list[str]]]) -> list[str]:
    """GitHub semantics: the LAST matching pattern decides (and may remove owners)."""
    owners: list[str] = []
    for regex, rule_owners in rules:
        if regex.match(path):
            owners = rule_owners
    return owners


def pattern_regex(pattern: str) -> re.Pattern:
    """gitignore-style CODEOWNERS pattern -> regex over repository-relative paths."""
    body = pattern.strip('/')
    anchored = pattern.startswith('/') or '/' in body
    tail = r'/.+$' if pattern.endswith('/') else r'(?:/.*)?$'
    if body.endswith('/*'):
        tail = '$'  # GitHub: "docs/*" owns files directly in docs/, not nested ones
    out = []
    for token in re.split(r'(\*\*/|/\*\*|\*\*|\*|\?)', body):
        out.append({'**/': '(?:.*/)?', '/**': '/.*', '**': '.*', '*': '[^/]*',
                    '?': '[^/]'}.get(token, re.escape(token)))
    return re.compile(('^' if anchored else r'^(?:.*/)?') + ''.join(out) + tail)


def changed_policy(base: str, root: Path) -> list[str] | None:
    done = subprocess.run(['git', '-C', str(root), 'diff', '--name-only', f'{base}...HEAD'],
                          capture_output=True, text=True, check=False)
    if done.returncode:
        print(done.stderr.strip(), file=sys.stderr)
        return None
    return [name for name in done.stdout.splitlines() if is_policy_path(name)]


def label_gate(base: str, labels: str, root: Path) -> int:
    changed = changed_policy(base, root)
    if changed is None:
        print(f'FAIL: cannot diff against {base}; checkout with fetch-depth: 0')
        return 1
    if changed and LABEL not in {label.strip() for label in labels.split(',')}:
        print('FAIL: this change edits policy files: ' + ', '.join(changed[:10]))
        print(f'      the owner must review it and add the "{LABEL}" label (CODEOWNERS approval)')
        return 1
    print(f'PASS: policy files changed: {len(changed)}' + (f' (label {LABEL} present)' if changed else ''))
    return 0


def base_guard(base: str, root: Path) -> int:
    with tempfile.TemporaryDirectory() as temp:
        archive = subprocess.run(['git', '-C', str(root), 'archive', base, TOOLS_DIR],
                                 capture_output=True, check=False)
        if archive.returncode:
            print(f'SKIP: {base} has no {TOOLS_DIR}/ yet (first adoption)')
            return 0
        subprocess.run(['tar', '-x', '-C', temp], input=archive.stdout, check=True)
        guard = Path(temp) / TOOLS_DIR / 'guard.py'
        codes = [subprocess.run([sys.executable, str(guard), '--root', str(root), *extra],
                                check=False).returncode for extra in ([], ['--functions'])]
    print('PASS: base-branch guard accepts this tree' if not any(codes)
          else 'FAIL: the base-branch guard rejects this tree')
    return 1 if any(codes) else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--governance', action='store_true')
    parser.add_argument('--base')
    parser.add_argument('--labels', default='')
    parser.add_argument('--base-guard')
    args = parser.parse_args(argv)
    root = args.root.resolve()
    if args.base_guard:
        return base_guard(args.base_guard, root)
    if args.base:
        return label_gate(args.base, args.labels, root)
    problems = governance_problems(root)
    for problem in problems:
        print(f'FAIL: {problem}')
    print('PASS: CODEOWNERS gives every policy file a real owner' if not problems else '')
    return 1 if problems else 0


if __name__ == '__main__':
    raise SystemExit(main())
