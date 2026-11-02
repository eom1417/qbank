#!/usr/bin/env python3
"""Self-tests for agent-level guards: Claude Code hooks and skill invocability."""
from __future__ import annotations

import json
import os

from kit_testing import KIT, RepoCase, python_function

SKILL = '---\nname: {name}\ndescription: Use when testing.\n{extra}---\n\nBody.\n'


class HookTests(RepoCase):
    def hook(self, mode: str, tool_input: dict, policy_change: bool = False):
        env = dict(os.environ, CLAUDE_PROJECT_DIR=str(self.root))
        env.pop('GENESIS_POLICY_CHANGE', None)
        if policy_change:
            env['GENESIS_POLICY_CHANGE'] = '1'
        event = json.dumps({'tool_name': 'X', 'tool_input': tool_input, 'cwd': str(self.root)})
        return self.tool('agent_hook.py', mode, stdin=event, env=env)

    def test_bypass_marker_blocked_before_write(self):
        done = self.hook('pre-edit', {'file_path': str(self.root / 'src/a.ts'),
                                      'content': '// eslint' + '-disable\n'})
        self.assertEqual(done.returncode, 2, done.stderr)

    def test_clean_write_allowed(self):
        done = self.hook('pre-edit', {'file_path': str(self.root / 'src/a.py'), 'content': 'x = 1\n'})
        self.assertEqual(done.returncode, 0, done.stderr)

    def test_policy_file_locked_after_bootstrap(self):
        target = {'file_path': str(self.root / 'engineering.json'), 'new_string': '{}'}
        self.assertEqual(self.hook('pre-edit', target).returncode, 2)
        self.assertEqual(self.hook('pre-edit', target, policy_change=True).returncode, 0)

    def test_policy_file_open_during_bootstrap(self):
        self.manifest['ready'] = False
        self.save()
        target = {'file_path': str(self.root / '.genesis/tools/guard.py'), 'content': 'x = 1\n'}
        self.assertEqual(self.hook('pre-edit', target).returncode, 0)

    def test_post_edit_feeds_violation_back(self):
        bad = self.put('src/big.py', python_function(70))
        done = self.hook('post-edit', {'file_path': str(bad)})
        self.assertEqual(done.returncode, 2)
        self.assertIn('70 lines', done.stderr)

    def test_post_edit_clean_file_silent(self):
        done = self.hook('post-edit', {'file_path': str(self.root / 'src/app.py')})
        self.assertEqual(done.returncode, 0, done.stderr)

    def test_dangerous_commands_blocked(self):
        for command in ('git push --force origin main', 'git reset --hard HEAD~1',
                        'git clean -fdx', 'git commit --no-verify -m x', 'git commit -nm x',
                        'git branch -D feature', 'rm -rf .', 'git restore .'):
            with self.subTest(command=command):
                self.assertEqual(self.hook('pre-bash', {'command': command}).returncode, 2)

    def test_ordinary_commands_allowed(self):
        for command in ('git push origin feature', 'git push --force-with-lease',
                        'python3 .genesis/tools/check.py --full > out.txt', 'npm test', 'git status'):
            with self.subTest(command=command):
                self.assertEqual(self.hook('pre-bash', {'command': command}).returncode, 0)

    def test_shell_write_to_policy_file_blocked(self):
        for command in ("sed -i 's/10/20/' .genesis/tools/guard_rules.py", 'echo {} > engineering.json',
                        "python3 -c \"open('.genesis/tools/guard_rules.py','w').write('')\"",
                        "node -e \"require('fs').writeFileSync('engineering.json','{}')\"",
                        'git checkout HEAD~3 -- .genesis/tools/guard.py'):
            with self.subTest(command=command):
                self.assertEqual(self.hook('pre-bash', {'command': command}).returncode, 2)


class SkillTests(RepoCase):
    def setUp(self):
        super().setUp()
        self.manifest['skills'] = {'model_invocable': ['tdd', 'grill-me'],
                                   'user_only': ['deploy-prod', 'to-spec']}
        self.save()

    def skills(self, *args: str):
        return self.tool('skills_policy.py', *args, '--root', str(self.root))

    def add_skill(self, name: str, extra: str = '', body: str = 'Body.\n',
                  homes=('.claude', '.agents')):
        for home in homes:
            text = SKILL.format(name=name, extra=extra).replace('Body.\n', body)
            self.put(f'{home}/skills/{name}/SKILL.md', text)

    def test_policy_compliant_skills_pass(self):
        self.add_skill('tdd')
        self.assertPasses(self.skills('--check'))

    def test_safe_slash_only_skill_is_unlocked(self):
        self.add_skill('grill-me', 'disable-model-invocation: true\n')
        self.put('.agents/skills/grill-me/agents/openai.yaml',
                 'policy:\n  allow_implicit_invocation: false\n')
        self.put('.claude/skills/grill-me/agents/openai.yaml',
                 'policy:\n  allow_implicit_invocation: false\n')
        self.assertFails(self.skills('--check'), 'should be callable by name')
        self.assertPasses(self.skills('--apply'))

    def test_risky_skill_is_locked_not_unlocked(self):
        self.add_skill('deploy-prod', body='Run `vercel deploy --prod`.\n')
        self.assertFails(self.skills('--check'), 'explicit-only')
        self.assertPasses(self.skills('--apply'))
        text = (self.root / '.claude/skills/deploy-prod/SKILL.md').read_text()
        self.assertIn('disable-model-invocation: true', text)

    def test_side_effect_skill_cannot_be_declared_safe(self):
        self.manifest['skills']['model_invocable'].append('shipper')
        self.save()
        self.add_skill('shipper', body='Finally run `git push origin main`.\n')
        self.assertFails(self.skills('--apply'), 'must be user_only')

    def test_unclassified_skill_fails(self):
        self.add_skill('mystery')
        self.assertFails(self.skills('--check'), 'unclassified skill')

    def test_name_must_match_folder(self):
        self.put('.claude/skills/tdd/SKILL.md', SKILL.format(name='other', extra=''))
        self.assertFails(self.skills('--check'), 'folder name')

    def test_agents_must_share_identical_skill_folders(self):
        self.add_skill('tdd')
        self.put('.claude/skills/tdd/reference.md', 'extra\n')
        self.assertFails(self.skills('--check'), 'files differ')

    def test_bundled_kit_skills_valid_and_synchronized(self):
        done = self.tool('skills_policy.py', '--check', '--root', str(KIT))
        self.assertPasses(done)
        self.assertIn('required 6/6 installed for 2 agent home(s)', done.stdout)


if __name__ == '__main__':
    import unittest
    unittest.main()
