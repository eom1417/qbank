#!/usr/bin/env python3
"""Commit hygiene, owner confirmation for outward actions, kit tool install, GitHub setup."""
from __future__ import annotations

import json
import os
import stat
import sys
import unittest
from pathlib import Path
from unittest import mock

import toolchain
from agent_hook import commit_skips_hooks
from commits import header_problem
from kit_testing import RepoCase

FAKE_GH = '''#!{python}
import json, sys
args = sys.argv[1:]
open({log!r}, 'a').write(json.dumps(args) + '\\n')
if args[:2] == ['repo', 'view']:
    print(json.dumps({{'nameWithOwner': 'me/app', 'defaultBranchRef': {{'name': 'main'}}}}))
elif args[:1] == ['api'] and args[1].endswith('/collaborators'):
    print({collaborators})
'''


class CommitTests(unittest.TestCase):
    def test_conventional_headers_pass(self):
        for header in ('feat(billing): add proration', 'fix: reject expired token',
                       'refactor(orders)!: split repository', 'Merge branch "feat/x"'):
            with self.subTest(header=header):
                self.assertIsNone(header_problem(header + '\n\nbody\n'))

    def test_free_text_headers_fail(self):
        for header in ('Update stuff', 'feat:missing space', 'wip', 'feature: wrong type'):
            with self.subTest(header=header):
                self.assertIsNotNone(header_problem(header))

    def test_commit_n_is_parsed_not_pattern_matched(self):
        self.assertFalse(commit_skips_hooks('git commit -m "handle -nan values"'))
        self.assertFalse(commit_skips_hooks('git commit -am "x -n"'))
        self.assertTrue(commit_skips_hooks('git commit -anm x'))
        self.assertTrue(commit_skips_hooks('git add . && git commit -n -m x'))


class OwnerConfirmationTests(RepoCase):
    def bash(self, command: str):
        event = json.dumps({'tool_input': {'command': command}})
        env = dict(os.environ, CLAUDE_PROJECT_DIR=str(self.root))
        return self.tool('agent_hook.py', 'pre-bash', stdin=event, env=env)

    def test_outward_actions_ask_the_owner(self):
        for command in ('npx vercel deploy --prod', 'gh pr merge 12 --squash', 'npm publish',
                        'terraform apply -auto-approve',
                        'python3 .genesis/tools/genesis.py governance --apply'):
            with self.subTest(command=command):
                done = self.bash(command)
                self.assertPasses(done)
                decision = json.loads(done.stdout)['hookSpecificOutput']
                self.assertEqual(decision['permissionDecision'], 'ask')

    def test_merges_and_plain_pushes_follow_the_owner_rule(self):
        # DEC-29, DEC-37 (owner): merging and pushing to main run on the owner's word in chat;
        # a push that rewrites or deletes remote history, or any other outward action, asks.
        quiet = ('git checkout main && git merge --ff-only feat/m4 && git branch -d feat/m4',
                 'git merge feat/m4', 'git merge --no-ff feat/m4', 'git push -u origin main',
                 'git push origin main', 'git merge --ff-only feat/m4 && git push origin main')
        asks = ('git push --force-with-lease origin main', 'git push origin +main',
                'git push origin :main', 'git push --mirror origin main',
                'git push --delete origin main', 'git push -d origin main',
                'git push --prune origin main', 'git merge feat/m4 && npm publish',
                'git push origin main && gh pr merge 3')
        for command in quiet:
            with self.subTest(command=command):
                self.assertEqual(self.bash(command).stdout.strip(), '')
        for command in asks:
            with self.subTest(command=command):
                decision = json.loads(self.bash(command).stdout)['hookSpecificOutput']
                self.assertEqual(decision['permissionDecision'], 'ask')

    def test_routine_commands_do_not_ask(self):
        for command in ('git push -u origin feat/login', 'npm test', 'git status'):
            with self.subTest(command=command):
                done = self.bash(command)
                self.assertPasses(done)
                self.assertEqual(done.stdout.strip(), '')


class ToolchainTests(unittest.TestCase):
    def test_pins_are_hash_locked(self):
        pins = toolchain.pins()
        self.assertEqual({name for name, _, _ in pins}, {'lizard', 'pathspec', 'pygments'})
        self.assertTrue(all(len(sha) == 64 for _, _, sha in pins))

    def test_without_pip_the_hash_checked_download_is_used(self):
        with mock.patch.object(toolchain, 'lizard_command', side_effect=[None, ['ok']]), \
             mock.patch.object(toolchain, '_pip_install', return_value=False), \
             mock.patch.object(toolchain, '_download_install', return_value=[]) as download:
            self.assertEqual(toolchain.ensure(), [])
        download.assert_called_once()

    def test_tampered_download_is_rejected(self):
        reply = mock.MagicMock()
        reply.__enter__.return_value.read.return_value = b'not the wheel'
        listing = mock.MagicMock()
        listing.__enter__.return_value = mock.MagicMock()
        with mock.patch('json.load', return_value={'urls': [
                {'url': 'https://x/w.whl', 'digests': {'sha256': 'a' * 64}}]}), \
             mock.patch('urllib.request.urlopen', side_effect=[listing, reply]):
            with self.assertRaisesRegex(ValueError, 'does not match'):
                toolchain._fetch_wheel('lizard', '1', 'a' * 64)


class GovernanceSetupTests(RepoCase):
    def fake_gh(self, collaborators: int) -> dict:
        bin_dir, log = self.root / 'bin', self.root / 'gh.log'
        bin_dir.mkdir()
        script = bin_dir / 'gh'
        script.write_text(FAKE_GH.format(python=sys.executable, log=str(log),
                                         collaborators=collaborators))
        script.chmod(script.stat().st_mode | stat.S_IEXEC)
        return dict(os.environ, PATH=f'{bin_dir}{os.pathsep}{os.environ["PATH"]}')

    def calls(self) -> list[list[str]]:
        return [json.loads(line) for line in (self.root / 'gh.log').read_text().splitlines()]

    def test_plan_changes_nothing(self):
        done = self.tool('github_setup.py', '--plan', env=self.fake_gh(1))
        self.assertPasses(done)
        self.assertIn('solo', done.stdout)
        self.assertFalse(any(call[:2] == ['label', 'create'] for call in self.calls()))

    def test_apply_creates_label_and_protects_default_branch(self):
        self.assertPasses(self.tool('github_setup.py', '--apply', env=self.fake_gh(3)))
        calls = self.calls()
        self.assertIn(['label', 'create', 'policy-change'], [c[:3] for c in calls])
        put = [c for c in calls if c[:3] == ['api', '-X', 'PUT']]
        self.assertEqual(put[0][3], 'repos/me/app/branches/main/protection')

    def test_without_gh_it_is_blocked(self):
        env = dict(os.environ, PATH=str(self.root / 'empty'))
        done = self.tool('github_setup.py', '--plan', env=env)
        self.assertFails(done, 'BLOCKED')


if __name__ == '__main__':
    unittest.main()
