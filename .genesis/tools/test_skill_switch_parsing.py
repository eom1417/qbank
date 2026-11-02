#!/usr/bin/env python3
"""Invocation switches are read as structured data: body text and comments never lock."""
from __future__ import annotations

from kit_testing import RepoCase
from skill_config import claude_locked, codex_locked

FRONT = '---\nname: risky\ndescription: Use when testing.\n{front}---\n\n{body}'


class StructuredLockTests(RepoCase):
    def setUp(self):
        super().setUp()
        self.manifest['skills'] = {'required': [], 'model_invocable': [], 'user_only': ['risky']}
        self.save()

    def add(self, front: str = '', body: str = 'Body.\n', codex: str = ''):
        for home in ('.claude', '.agents'):
            self.put(f'{home}/skills/risky/SKILL.md', FRONT.format(front=front, body=body))
            self.put(f'{home}/skills/risky/agents/openai.yaml', codex)

    def check(self):
        return self.tool('skills_policy.py', '--check', '--root', str(self.root))

    def test_claude_flag_in_body_does_not_lock(self):
        """Regression: 'disable-model-invocation: true' in the SKILL.md body counted as a lock."""
        self.add(body='disable-model-invocation: true\n',
                 codex='policy:\n  allow_implicit_invocation: false\n')
        self.assertFails(self.check(), 'still model-invocable in Claude')

    def test_commented_codex_flag_does_not_lock(self):
        """Regression: '# allow_implicit_invocation: false' (a comment) counted as a lock."""
        self.add(front='disable-model-invocation: true\n',
                 codex='# allow_implicit_invocation: false\n')
        self.assertFails(self.check(), 'still model-invocable in Codex')

    def test_real_locks_in_both_pass(self):
        self.add(front='disable-model-invocation: true\n',
                 codex='policy:\n  allow_implicit_invocation: false\n')
        self.assertPasses(self.check())

    def test_apply_turns_the_fake_locks_into_real_ones(self):
        self.add(body='disable-model-invocation: true\n',
                 codex='# allow_implicit_invocation: false\n')
        self.assertPasses(self.tool('skills_policy.py', '--apply', '--root', str(self.root)))
        text = (self.root / '.claude/skills/risky/SKILL.md').read_text()
        self.assertTrue(claude_locked(text), text)


class ParserTests(RepoCase):
    def test_claude_reads_only_top_level_frontmatter_booleans(self):
        cases = {'---\ndisable-model-invocation: true\n---\n': True,
                 '---\ndisable-model-invocation: true  # note\n---\n': True,
                 '---\nname: x\n---\ndisable-model-invocation: true\n': False,
                 '---\ndisable-model-invocation: "true"\n---\n': False,
                 '---\nmeta:\n  disable-model-invocation: true\n---\n': False,
                 '---\n# disable-model-invocation: true\n---\n': False}
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertEqual(claude_locked(text), expected)

    def test_codex_reads_only_policy_children(self):
        cases = {'policy:\n  allow_implicit_invocation: false\n': True,
                 'policy:\n  allow_implicit_invocation: false  # x\n': True,
                 'policy: {allow_implicit_invocation: false}\n': True,
                 '# allow_implicit_invocation: false\n': False,
                 'policy:\n  # allow_implicit_invocation: false\n': False,
                 'other:\n  allow_implicit_invocation: false\n': False,
                 'policy:\n  allow_implicit_invocation: "false"\n': False,
                 'policy:\n  nested:\n    allow_implicit_invocation: false\n': False}
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertEqual(codex_locked(text), expected)
