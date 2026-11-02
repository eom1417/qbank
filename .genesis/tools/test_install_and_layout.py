#!/usr/bin/env python3
"""The kit lives in .genesis/, never claims project folders, installs without overwriting,
and keeps one skill source with an exact Claude mirror (copy or symlink)."""
from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path

from guard_core import is_policy_path
from kit_testing import KIT, RepoCase
from skill_sync import install_user, start_skill, sync

PROJECT_PATHS = ('docs/api-guide.md', 'tools/seed_db.py', 'prompts/system_prompt.md',
                 'scripts/release.sh', 'adapters/http.py', 'proofs/README.md', 'BLUEPRINT.md')


class NamespaceTests(RepoCase):
    def test_common_project_folders_stay_the_projects(self):
        for rel in PROJECT_PATHS:
            with self.subTest(rel=rel):
                self.assertFalse(is_policy_path(rel))

    def test_agent_may_edit_project_docs_after_bootstrap(self):
        env = dict(os.environ, CLAUDE_PROJECT_DIR=str(self.root))
        env.pop('GENESIS_POLICY_CHANGE', None)
        for rel in PROJECT_PATHS:
            event = json.dumps({'tool_input': {'file_path': str(self.root / rel), 'content': 'x'}})
            with self.subTest(rel=rel):
                self.assertPasses(self.tool('agent_hook.py', 'pre-edit', stdin=event, env=env))

    def test_kit_files_are_policy(self):
        for rel in ('.genesis/tools/guard.py', '.genesis/docs/13_GUARD_CATALOG.md',
                    '.genesis/proofs/lint/x.probe', '.genesis/recipes/python/recipe.json'):
            with self.subTest(rel=rel):
                self.assertTrue(is_policy_path(rel))


class InstallTests(RepoCase):
    def install(self):
        return self.tool('install.py', '--into', str(self.root))

    def test_fresh_install_copies_the_kit(self):
        self.assertPasses(self.install())
        for rel in ('START_HERE.md', 'AGENTS.md', '.genesis/tools/genesis.py',
                    '.agents/skills/feature-delivery/SKILL.md', '.githooks/commit-msg'):
            with self.subTest(rel=rel):
                self.assertTrue((self.root / rel).is_file())
        self.assertTrue(os.access(self.root / '.githooks/pre-commit', os.X_OK))
        self.assertFalse((self.root / '.genesis/.pylib').exists())

    def test_existing_files_are_never_overwritten(self):
        self.put('AGENTS.md', 'my own rules\n')
        done = self.install()
        self.assertPasses(done)
        self.assertIn('MERGE: AGENTS.md', done.stdout)
        self.assertEqual((self.root / 'AGENTS.md').read_text(), 'my own rules\n')
        self.assertTrue((self.root / 'AGENTS.md.genesis-new').is_file())

    def test_install_into_the_kit_itself_is_refused(self):
        done = self.tool('install.py', '--into', str(KIT / '.genesis'))
        self.assertFails(done, 'inside the kit itself')


class MirrorTests(RepoCase):
    def skill(self, home: str, name: str, body: str = 'Body.\n'):
        self.put(f'{home}/skills/{name}/SKILL.md',
                 f'---\nname: {name}\ndescription: Use when testing.\n---\n\n{body}')

    def test_sync_copies_the_source_and_adopts_installer_extras(self):
        self.skill('.agents', 'one')
        self.skill('.claude', 'two')
        self.assertEqual(len(sync(self.root)), 1)
        for home in ('.agents', '.claude'):
            for name in ('one', 'two'):
                self.assertTrue((self.root / home / 'skills' / name / 'SKILL.md').is_file())

    def test_source_wins_over_a_differing_mirror_and_says_so(self):
        self.skill('.agents', 'one', 'Source.\n')
        self.skill('.claude', 'one', 'Edited mirror.\n')
        self.assertIn('replaced', ' '.join(sync(self.root)))
        self.assertIn('Source.', (self.root / '.claude/skills/one/SKILL.md').read_text())

    def test_symlinked_mirror_is_accepted_by_guard_and_policy(self):
        self.manifest['source_roots'] = ['.']
        self.manifest['skills'] = {'required': ['one'], 'model_invocable': ['one'], 'user_only': []}
        self.save()
        self.skill('.agents', 'one')
        (self.root / '.claude').mkdir()
        (self.root / '.claude/skills').symlink_to('../.agents/skills')
        self.git_init()
        self.assertPasses(self.guard())
        self.assertPasses(self.tool('skills_policy.py', '--check', '--root', str(self.root)))

    def test_user_level_start_skill_points_at_this_kit(self):
        home = self.root / 'home'
        written = install_user(KIT, home)
        self.assertEqual(len(written), 2)
        text = Path(written[0]).read_text()
        self.assertIn('name: genesis-start', text)
        self.assertIn(str(KIT / '.genesis/tools/genesis.py'), text)
        self.assertIn('ابدأ مشروع جديد', start_skill(KIT))


class KitShapeTests(RepoCase):
    def test_kit_mirror_matches_its_source(self):
        done = subprocess.run(['diff', '-r', str(KIT / '.agents/skills'),
                               str(KIT / '.claude/skills')], capture_output=True, text=True)
        self.assertEqual(done.returncode, 0, done.stdout)

    def test_kit_root_holds_only_entry_files(self):
        allowed = {'.agents', '.claude', '.genesis', '.github', '.githooks', '.editorconfig',
                   '.gitattributes', '.gitignore', 'AGENTS.md', 'CLAUDE.md', 'START_HERE.md',
                   'BLUEPRINT.md', 'engineering.json', '.git'}
        extra = {p.name for p in KIT.iterdir()} - allowed
        self.assertEqual(extra, set(), 'the kit must not claim more root names')


class DocReferenceTests(RepoCase):
    """Every kit path named in the docs, prompts and skills exists (no stale references)."""
    PATH = re.compile(r'\.genesis/(?:docs|prompts|tools|templates|recipes|adapters)/[\w./-]+'
                      r'|\.genesis/docs/\d\d(?![\w])|(?<=DOCS_DIR\}/)\d\d_[A-Z_]+\.md')

    def test_kit_paths_in_markdown_and_tools_exist(self):
        docs = [p for p in KIT.rglob('*.md') if '.git' not in p.parts and '.pylib' not in p.parts]
        docs += [p for p in (KIT / '.genesis/tools').glob('*.py') if not p.name.startswith('test_')]
        missing = set()
        for doc in docs:
            for ref in self.PATH.findall(doc.read_text(encoding='utf-8')):
                ref = ref.rstrip('.,)`')
                if not self.resolves(ref):
                    missing.add(f'{doc.relative_to(KIT)}: {ref}')
        self.assertEqual(sorted(missing), [])

    @staticmethod
    def resolves(ref: str) -> bool:
        if re.fullmatch(r'\d\d_[A-Z_]+\.md', ref):
            ref = '.genesis/docs/' + ref
        if re.fullmatch(r'\.genesis/docs/\d\d', ref):
            return any((KIT / '.genesis/docs').glob(ref.rsplit('/', 1)[1] + '_*.md'))
        return (KIT / ref).exists() or ref.endswith(('/<name>', '/<gate>')) or '<' in ref
