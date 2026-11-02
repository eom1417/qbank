#!/usr/bin/env python3
"""Agent rule files are governed like guards; every file of a skill is scanned."""
from __future__ import annotations

import json
import os
import subprocess

from guard_core import is_policy_path
from kit_testing import KIT, RepoCase
from policy_gate import SENSITIVE_SAMPLES, owners_of, parse_codeowners

RULE_FILES = ('AGENTS.md', 'CLAUDE.md', '.genesis/docs/01_PRINCIPLES.md',
              '.genesis/prompts/01_BOOTSTRAP.md',
              '.claude/skills/feature-delivery/SKILL.md', '.agents/skills/tdd/SKILL.md')
SKILL = '---\nname: {name}\ndescription: Use when testing.\n---\n\nBody.\n'


class RuleFileGovernanceTests(RepoCase):
    def test_agent_rule_files_are_policy(self):
        for rel in RULE_FILES:
            with self.subTest(rel=rel):
                self.assertTrue(is_policy_path(rel))

    def test_blueprint_stays_editable_project_data(self):
        self.assertFalse(is_policy_path('BLUEPRINT.md'))

    def test_kit_codeowners_owns_every_sensitive_file(self):
        # Works on the template (@CONFIGURE_ME) and after bootstrap (a real handle).
        rules = parse_codeowners((KIT / '.github' / 'CODEOWNERS').read_text())
        for rel in SENSITIVE_SAMPLES + RULE_FILES:
            with self.subTest(rel=rel):
                self.assertTrue(is_policy_path(rel), f'{rel} owned but not label-gated')
                self.assertTrue(owners_of(rel, rules), f'{rel} has no code owner')

    def test_pr_editing_agents_md_needs_the_label(self):
        self.git_init()
        git = ['git', '-C', str(self.root), '-c', 'user.email=a@b', '-c', 'user.name=t']
        self.put('AGENTS.md', 'Hard limit: 400 lines.\n')
        subprocess.run(git + ['add', '-A'], check=True)
        subprocess.run(git + ['commit', '-qm', 'base'], check=True)
        self.put('AGENTS.md', 'Hard limit: 4000 lines.\n')
        subprocess.run(git + ['commit', '-qam', 'loosen'], check=True)
        done = self.tool('policy_gate.py', '--root', str(self.root), '--base', 'HEAD~1')
        self.assertFails(done, 'AGENTS.md')

    def test_agent_cannot_edit_rules_after_bootstrap(self):
        env = dict(os.environ, CLAUDE_PROJECT_DIR=str(self.root))
        env.pop('GENESIS_POLICY_CHANGE', None)
        for rel in RULE_FILES[:4]:
            event = json.dumps({'tool_input': {'file_path': str(self.root / rel), 'content': 'x'}})
            with self.subTest(rel=rel):
                done = self.tool('agent_hook.py', 'pre-edit', stdin=event, env=env)
                self.assertEqual(done.returncode, 2, done.stderr)


class SkillScriptTests(RepoCase):
    def setUp(self):
        super().setUp()
        self.manifest['skills'] = {'required': [], 'model_invocable': ['feature-delivery'],
                                   'user_only': []}
        self.save()

    def add(self, rel: str, data):
        for home in ('.claude', '.agents'):
            self.put(f'{home}/skills/feature-delivery/SKILL.md', SKILL.format(name='feature-delivery'))
            path = self.root / home / 'skills' / 'feature-delivery' / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data if isinstance(data, bytes) else data.encode())

    def check(self):
        return self.tool('skills_policy.py', '--check', '--root', str(self.root))

    def test_reviewer_python_script_is_caught(self):
        """Regression: scripts/danger.py with os.system('git push origin main') returned []."""
        self.add('scripts/danger.py', 'import os\nos.system("git push origin main")\n')
        self.assertFails(self.check(), 'contains "git push')

    def test_argv_style_command_in_javascript_is_caught(self):
        self.add('scripts/ship.js', "spawn('git', ['push']);\nexecFile('npm', ['publish']);\n"
                                    .replace("['push']", "'push'").replace("['publish']", "'publish'"))
        self.assertFails(self.check(), 'must be user_only')

    def test_binary_file_cannot_be_inspected(self):
        self.add('bin/tool', b'\x7fELF\x00\x01\x02')
        self.assertFails(self.check(), 'cannot be inspected')

    def test_harmless_script_is_fine(self):
        self.add('scripts/count.py', 'import sys\nprint(len(sys.argv))\n')
        self.assertPasses(self.check())
