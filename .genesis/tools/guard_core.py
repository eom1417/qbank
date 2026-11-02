"""Manifest loading and authored-file discovery shared by every guard tool.

One owner for: reading engineering.json, validating it, and deciding which
files are authored (subject to 400/50/10) versus generated/vendored.
"""
from __future__ import annotations

import fnmatch
import json
import os
import subprocess
from pathlib import Path

from layout import (BLUEPRINT, KIT, MANIFEST, PROOF_DIR, RECIPE_DIR, SKILL_HOMES, SKILL_MIRROR,
                    SKILL_SOURCE)

BUNDLED_SKILLS = frozenset({
    'engineering-foundation', 'feature-delivery', 'bugfix-protocol',
    'boundary-review', 'guard-proofs', 'safe-refactor',
})
PRUNE_DIRS = frozenset({
    '.git', 'node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build',
    '.next', '.nuxt', '.svelte-kit', 'target', 'coverage', '.tox', '.mypy_cache',
    '.ruff_cache', '.pytest_cache', '.gradle', 'Pods', 'DerivedData',
    '.dart_tool', 'vendor', '.terraform', '.pylib',
})
LOCKFILES = frozenset({
    'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock',
    'bun.lockb', 'deno.lock', 'skills-lock.json', 'poetry.lock', 'uv.lock', 'Pipfile.lock',
    'pdm.lock', 'Cargo.lock', 'go.sum', 'go.work.sum', 'composer.lock', 'Gemfile.lock',
    'pubspec.lock', 'Package.resolved', 'packages.lock.json', 'Podfile.lock', 'mix.lock',
    'flake.lock', 'gradle.lockfile', '.terraform.lock.hcl',
})
ASSET_EXTENSIONS = frozenset({
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.icns', '.bmp', '.tif', '.tiff',
    '.svg', '.psd', '.ai', '.sketch', '.fig', '.woff', '.woff2', '.ttf', '.otf', '.eot',
    '.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.webm', '.mov', '.pdf', '.docx', '.xlsx', '.pptx',
    '.zip', '.gz', '.tgz', '.7z', '.wasm', '.jar', '.snap', '.lottie', '.riv', '.glb', '.gltf',
    '.sha256', '.sig', '.asc',
})
# Files that define the rules. Changing them is an owner decision (CODEOWNERS + label in CI).
# Includes the rules the agent reads (AGENTS.md, CLAUDE.md, kit docs, prompts, skills), not just
# the scripts that enforce them. Everything else (docs/, tools/, prompts/ ...) is the project's.
POLICY_PATHS = (
    MANIFEST, f'{KIT}/*', '.github/workflows/*', '.github/CODEOWNERS', 'CODEOWNERS',
    '.githooks/*', '.claude/*', '.agents/*', 'AGENTS.md', 'CLAUDE.md', 'START_HERE.md',
    'skills-lock.json', 'eslint.config.*', '.eslintrc*', 'ruff.toml', '.ruff.toml', '.golangci.*',
    '.swiftlint.yml', 'detekt*.yml', '.dependency-cruiser.*', '.importlinter', 'knip.*',
    '.jscpd.json', 'stylelint.config.*', '.stylelintrc*', 'biome.json', 'tsconfig*.json',
    '.semgrep*', '.gitleaks.toml', '.secretlintrc*', 'commitlint.config.*',
)
# Project data and personal settings: never policy, even though they sit near policy files.
NOT_POLICY = (BLUEPRINT, '.claude/settings.local.json')


def is_policy_path(rel: str) -> bool:
    if rel in NOT_POLICY:
        return False
    return any(fnmatch.fnmatchcase(rel, pattern) for pattern in POLICY_PATHS)


PROBE_SUFFIX = '.probe'
TEMPLATE_SUFFIXES = (PROBE_SUFFIX, '.recipe')
# A "generated" pattern that matches any of these is hiding authored code.
AUTHORED_PROBES = (
    'src/app.py', 'app/main.ts', 'lib/core.go', 'main.py', 'index.js', 'tools/seed.py',
    'docs/guide.md', f'{KIT}/tools/guard.py', 'README.md', MANIFEST, BLUEPRINT,
    'src/ui/Button.tsx', 'internal/service/user.go', '.github/workflows/ci.yml',
)


class ManifestError(ValueError):
    """engineering.json is missing, invalid or not yet bootstrapped."""


def read_manifest(root: Path) -> dict:
    try:
        data = json.loads((root / MANIFEST).read_text(encoding='utf-8'))
    except (OSError, ValueError) as exc:
        raise ManifestError(f'{MANIFEST} unreadable or invalid: {exc}') from exc
    if not isinstance(data, dict):
        raise ManifestError(f'{MANIFEST} must be a JSON object')
    return data


def load_manifest(root: Path, require_ready: bool = True) -> dict:
    data = read_manifest(root)
    if require_ready and (data.get('ready') is not True or
                          data.get('project') in (None, '', 'CONFIGURE_ME')):
        raise ManifestError('Bootstrap incomplete: ready=true only after all real gates are proven')
    problems = manifest_problems(data)
    if problems:
        raise ManifestError('; '.join(problems))
    return data


def manifest_problems(data: dict) -> list[str]:
    problems = []
    roots = data.get('source_roots')
    if not _string_list(roots, allow_empty=False):
        problems.append('source_roots must list every authored root ("." = whole repository)')
    exts = data.get('owned_extensions')
    if not _string_list(exts, allow_empty=False) or not all(e.startswith('.') for e in exts):
        problems.append('owned_extensions must list every authored extension (".py", ".ts", ...)')
    if not _string_list(data.get('owned_filenames', []), allow_empty=True):
        problems.append('owned_filenames must be a list of filename patterns')
    if not _string_list(data.get('external_function_gates', []), allow_empty=True):
        problems.append('external_function_gates must be a list of extensions')
    for key in ('asset_extensions', 'asset_patterns'):
        if not _string_list(data.get(key, []), allow_empty=True):
            problems.append(f'{key} must be a list of strings')
    problems.extend(generated_problems(data.get('generated', [])))
    return problems


def _string_list(value, allow_empty: bool) -> bool:
    if not isinstance(value, list) or (not value and not allow_empty):
        return False
    return all(isinstance(item, str) and item.strip() for item in value)


def generated_problems(entries) -> list[str]:
    if not isinstance(entries, list):
        return ['generated must be a list of {pattern, reason, regenerate} objects']
    problems = []
    for item in entries:
        problems.extend(_generated_entry_problems(item))
    return problems


def _generated_entry_problems(item) -> list[str]:
    if not isinstance(item, dict):
        return ['generated entries must be objects with pattern, reason, regenerate']
    pattern = item.get('pattern')
    missing = [key for key in ('pattern', 'reason', 'regenerate')
               if not isinstance(item.get(key), str) or not item[key].strip()]
    if missing:
        return [f'generated entry {pattern!r} missing: {", ".join(missing)}']
    hits = [probe for probe in AUTHORED_PROBES if path_matches(probe, pattern)]
    if hits:
        return [f'generated pattern {pattern!r} is too broad: it would hide {hits[0]}']
    return _verify_problems(pattern, item.get('verify'))


# Commands that copy or restore files cannot prove that anything was generated.
NOT_GENERATORS = frozenset({
    'git', 'cp', 'mv', 'rsync', 'cat', 'tar', 'unzip', 'ln', 'install', 'dd', 'curl', 'wget',
    'scp', 'ditto', 'robocopy', 'xcopy', 'copy', 'echo', 'true', 'printf', 'touch', 'env',
    'cmd',
})


def _verify_problems(pattern: str, verify) -> list[str]:
    if verify is None:
        return [f'generated entry {pattern!r} needs "verify": the generator command that '
                'recreates these files from their sources (checked in full gates)']
    if not _string_list(verify, allow_empty=False):
        return [f'generated entry {pattern!r}: verify must be an argv list']
    if Path(verify[0]).name.lower() in NOT_GENERATORS or '-c' in verify[1:2] or '-e' in verify[1:2]:
        return [f'generated entry {pattern!r}: {verify[0]} copies, restores or echoes files; '
                'verify must run the real generator']
    return []


def path_matches(rel: str, pattern: str) -> bool:
    """Patterns without '/' match the file name anywhere; others the full path."""
    target = rel if '/' in pattern else rel.rsplit('/', 1)[-1]
    return fnmatch.fnmatchcase(target, pattern)


def vendored_skill_dirs(root: Path) -> list[str]:
    """Third-party skills recorded in skills-lock.json are reproducible vendor code."""
    try:
        data = json.loads((root / 'skills-lock.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return []
    skills = data.get('skills') if isinstance(data, dict) else None
    if not isinstance(skills, dict):
        return []
    names = [name for name, entry in skills.items() if _locked_skill(name, entry)]
    return [f'{home}/{name}/' for home in SKILL_HOMES for name in names]


def _locked_skill(name, entry) -> bool:
    """A real lock entry names its upstream source; bundled skills are never vendor."""
    if not isinstance(name, str) or not isinstance(entry, dict):
        return False
    source = entry.get('source')
    return isinstance(source, str) and bool(source.strip()) and _safe_skill_name(name)


def _safe_skill_name(name: str) -> bool:
    return name not in BUNDLED_SKILLS and name not in ('', '.', '..') and '/' not in name


def is_owned_type(name: str, manifest: dict) -> bool:
    suffix = os.path.splitext(name)[1]
    if suffix and suffix in manifest['owned_extensions']:
        return True
    return any(fnmatch.fnmatchcase(name, pat) for pat in manifest.get('owned_filenames', []))


def is_asset(rel: str, manifest: dict) -> bool:
    suffix = os.path.splitext(rel)[1].lower()
    if suffix in ASSET_EXTENSIONS or suffix in manifest.get('asset_extensions', []):
        return True
    return any(path_matches(rel, pat) for pat in manifest.get('asset_patterns', []))


def generated_entry(rel: str, manifest: dict) -> dict | None:
    for item in manifest.get('generated', []):
        if path_matches(rel, item['pattern']):
            return item
    return None


def is_template(rel: str, name: str) -> bool:
    """Proof fixtures and recipe templates: inert text, line-limited only."""
    if rel.startswith(PROOF_DIR):
        return name.endswith(PROBE_SUFFIX)
    return rel.startswith(RECIPE_DIR) and name.endswith(TEMPLATE_SUFFIXES)


def classify(rel: str, manifest: dict, vendored: list[str]) -> str:
    """'owned' | 'generated' | 'asset' | 'probe' | 'unclassified' for a repo-relative path."""
    name = rel.rsplit('/', 1)[-1]
    if is_template(rel, name):
        return 'probe'
    if name in LOCKFILES or any(rel.startswith(prefix) for prefix in vendored):
        return 'generated'
    if rel.startswith(SKILL_MIRROR + '/'):
        return 'generated'  # exact mirror of SKILL_SOURCE; skills_policy --check proves identity
    if generated_entry(rel, manifest) is not None:
        return 'generated'
    if is_owned_type(name, manifest):
        return 'owned'
    return 'asset' if is_asset(rel, manifest) else 'unclassified'


def normalize_root(value: str) -> str:
    value = value.strip().rstrip('/')
    while value.startswith('./'):
        value = value[2:]
    return value or '.'


def under_roots(rel: str, roots: list[str]) -> bool:
    return any(r == '.' or rel == r or rel.startswith(r + '/') for r in roots)


def root_problems(root: Path, roots: list[str]) -> list[str]:
    problems = []
    for rel in roots:
        path = (root / rel).resolve()
        if not path.is_dir() or not path.is_relative_to(root):
            problems.append(f'Invalid or missing source root: {rel}')
    return problems


def git_listing(root: Path) -> list[str] | None:
    command = ['git', '-C', str(root), 'ls-files', '--cached', '--others',
               '--exclude-standard', '-z']
    try:
        done = subprocess.run(command, capture_output=True, check=False)
    except OSError:
        return None
    if done.returncode:
        return None
    names = {raw.decode('utf-8', 'surrogateescape') for raw in done.stdout.split(b'\0') if raw}
    return sorted(names)


def walk_listing(root: Path, roots: list[str]) -> list[str]:
    found = set()
    for rel_root in roots:
        for dirpath, dirnames, filenames in os.walk(root / rel_root):
            dirnames[:] = [d for d in dirnames if d not in PRUNE_DIRS]
            for name in filenames:
                found.add((Path(dirpath) / name).relative_to(root).as_posix())
    return sorted(found)


class Inventory:
    """Every tracked file sorted into exactly one class."""

    def __init__(self):
        self.owned: list[str] = []
        self.generated: list[str] = []
        self.probes: list[str] = []
        self.assets = 0
        self.problems: list[str] = []


def collect(root: Path, manifest: dict) -> Inventory:
    roots = [normalize_root(r) for r in manifest['source_roots']]
    inventory = Inventory()
    inventory.problems = root_problems(root, roots)
    listing = git_listing(root)
    names = listing if listing is not None else walk_listing(root, roots)
    vendored = vendored_skill_dirs(root)
    for rel in names:
        if rel == SKILL_MIRROR and is_skill_link(root):
            continue
        if _exists(root / rel):
            _sort_into(inventory, rel, classify(rel, manifest, vendored), roots)
    if not inventory.owned:
        inventory.problems.append('No authored files matched: inspect source_roots/owned_extensions')
    return inventory


def _sort_into(inventory: Inventory, rel: str, kind: str, roots: list[str]) -> None:
    if kind == 'unclassified':
        inventory.problems.append(
            f'{rel}: unclassified file type; add it to owned_extensions/owned_filenames, '
            'asset_extensions/asset_patterns, or a verified generated entry')
    elif kind == 'asset':
        inventory.assets += 1
    elif kind == 'generated':
        inventory.generated.append(rel)
    elif not under_roots(rel, roots):
        inventory.problems.append(f'{rel}: authored file outside declared source_roots')
    elif kind == 'probe':
        inventory.probes.append(rel)
    else:
        inventory.owned.append(rel)


def is_skill_link(root: Path) -> bool:
    """The Claude skill home may be a symlink to the single source (one copy, no drift)."""
    link = root / SKILL_MIRROR
    return link.is_symlink() and link.resolve() == (root / SKILL_SOURCE).resolve()


def _exists(path: Path) -> bool:
    return path.is_symlink() or path.is_file()
