#!/usr/bin/env python3
"""Each client locks separately; every policy category has a code owner; project files stay free."""
from __future__ import annotations

from guard_core import is_policy_path
from kit_testing import KIT, RepoCase
from policy_gate import coverage_samples, owners_of, parse_codeowners

SKILL = '---\nname: {name}\ndescription: Use when testing.\n{lock}---\n\nBody.\n'
KIT_ONLY_TEMPLATE = ''.join(f'/{p} @owner\n' for p in (
    'engineering.json', 'tools/', '.genesis/proofs/', '.genesis/', '.github/', '.claude/', '.githooks/',
    '.agents/', 'adapters/', 'AGENTS.md', 'CLAUDE.md', 'docs/', 'prompts/', 'skills-lock.json'))


class PerClientLockTests(RepoCase):
    def setUp(self):
        super().setUp()
        self.manifest['skills'] = {'required': [], 'model_invocable': ['safe'],
                                   'user_only': ['risky']}
        self.save()

    def add(self, name: str, claude_locked: bool, codex_locked: bool):
        lock = 'disable-model-invocation: true\n' if claude_locked else ''
        policy = 'false' if codex_locked else 'true'
        for home in ('.claude', '.agents'):
            self.put(f'{home}/skills/{name}/SKILL.md', SKILL.format(name=name, lock=lock))
            self.put(f'{home}/skills/{name}/agents/openai.yaml',
                     f'policy:\n  allow_implicit_invocation: {policy}\n')

    def check(self):
        return self.tool('skills_policy.py', '--check', '--root', str(self.root))

    def test_claude_unlocked_codex_locked_fails(self):
        """Regression: PASSed because a lock in either client counted as locked."""
        self.add('risky', claude_locked=False, codex_locked=True)
        self.assertFails(self.check(), 'still model-invocable in Claude')

    def test_claude_locked_codex_unlocked_fails(self):
        self.add('risky', claude_locked=True, codex_locked=False)
        self.assertFails(self.check(), 'still model-invocable in Codex')

    def test_both_locked_passes(self):
        self.add('risky', claude_locked=True, codex_locked=True)
        self.assertPasses(self.check())

    def test_model_invocable_open_in_both_passes(self):
        self.add('safe', claude_locked=False, codex_locked=False)
        self.assertPasses(self.check())

    def test_model_invocable_locked_in_one_client_fails(self):
        self.add('safe', claude_locked=False, codex_locked=True)
        self.assertFails(self.check(), 'locked in Codex')

    def test_apply_locks_both_clients(self):
        self.add('risky', claude_locked=False, codex_locked=False)
        self.assertPasses(self.tool('skills_policy.py', '--apply', '--root', str(self.root)))

    def test_apply_reuses_an_existing_policy_block(self):
        self.add('risky', claude_locked=False, codex_locked=False)
        for home in ('.claude', '.agents'):
            self.put(f'{home}/skills/risky/agents/openai.yaml', 'policy:\n  products: [x]\n')
        self.assertPasses(self.tool('skills_policy.py', '--apply', '--root', str(self.root)))
        text = (self.root / '.claude/skills/risky/agents/openai.yaml').read_text()
        self.assertEqual(text.count('policy:'), 1, text)


class PolicyCategoryOwnershipTests(RepoCase):
    def governance(self):
        return self.tool('policy_gate.py', '--governance', '--root', str(self.root))

    def test_template_without_config_rules_fails(self):
        """Owning only the kit folders leaves tsconfig.json, eslint.config.mjs... unowned."""
        self.put('.github/CODEOWNERS', KIT_ONLY_TEMPLATE)
        done = self.governance()
        for name in ('tsconfig.json', 'eslint.config.mjs', '.gitleaks.toml', 'knip.config.ts',
                     'biome.json'):
            with self.subTest(name=name):
                self.assertFails(done, f'gives no owner to {name}')

    def test_every_policy_category_is_sampled_and_owned_by_the_template(self):
        rules = parse_codeowners((KIT / '.github' / 'CODEOWNERS').read_text())
        for sample in coverage_samples():
            with self.subTest(sample=sample):
                self.assertTrue(is_policy_path(sample))
                self.assertTrue(owners_of(sample, rules), f'{sample} has no code owner')

    def test_bootstrap_entrypoints_are_governed(self):
        rules = parse_codeowners((KIT / '.github' / 'CODEOWNERS').read_text())
        for name in ('START_HERE.md', 'AGENTS.md', '.genesis/GUIDE_AR.md'):
            with self.subTest(name=name):
                self.assertTrue(is_policy_path(name))
                self.assertTrue(owners_of(name, rules))

    def test_product_files_need_no_owner_approval(self):
        rules = parse_codeowners((KIT / '.github' / 'CODEOWNERS').read_text())
        for rel in ('src/app.py', 'packages/web/tsconfig.json', 'src/eslint.config.mjs',
                    'BLUEPRINT.md', 'docs/api-guide.md', 'tools/seed_db.py',
                    'prompts/system_prompt.md', 'scripts/release-notes.sh'):
            with self.subTest(rel=rel):
                self.assertFalse(is_policy_path(rel))
        for rel in ('src/app.py', 'packages/web/tsconfig.json', 'docs/api-guide.md',
                    'prompts/system_prompt.md'):
            self.assertEqual(owners_of(rel, rules), [])

    def test_filled_template_passes(self):
        text = (KIT / '.github' / 'CODEOWNERS').read_text().replace('@CONFIGURE_ME', '@owner')
        self.put('.github/CODEOWNERS', text)
        self.assertPasses(self.governance())
