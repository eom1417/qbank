#!/usr/bin/env python3
"""A proof must be specific, reach CI, and generated files must really regenerate.

Each test replays a setup that once reported PASS/PROVED.
"""
from __future__ import annotations

import sys

from kit_testing import KIT, TOOLS, RepoCase, python_function
from test_check import RunnerCase

GUARD = [sys.executable, str(TOOLS / 'guard.py'), '--functions', '--root', '.']
SKILL = '---\nname: {name}\ndescription: Use when testing.\n---\n\nBody.\n'


class GateSpecificityTests(RunnerCase):
    def test_size_guard_cannot_prove_security(self):
        """Regression: security gate running the function-length guard was PROVED."""
        self.configure(security=GUARD)
        self.put('.genesis/proofs/security/src/probe_sec.py.probe', python_function(60))
        self.assertFails(self.check('--only', 'security', '--prove'),
                         'measures size only; it cannot prove security')

    def test_size_violation_cannot_prove_a_non_size_gate(self):
        self.configure()
        self.put('.genesis/proofs/lint/src/probe_lint.py.probe', python_function(60) + '# VIOLATION_LINT\n')
        self.assertFails(self.check('--only', 'lint', '--prove'), 'a size violation cannot prove')

    def test_security_fixture_needs_a_security_violation(self):
        self.configure()
        self.put('.genesis/proofs/security/src/probe_sec.py.probe', 'x = 1\n')
        self.assertFails(self.check('--only', 'security', '--prove'),
                         'no recognisable security violation')

    def test_gate_failing_for_something_else_is_caught_by_the_control(self):
        """Fixture has a secret AND an unrelated marker the 'security' gate really checks."""
        self.configure(security=[sys.executable, 'checks/find.py', 'UNRELATED'])
        self.put('.genesis/proofs/security/src/probe_sec.py.probe',
                 "TOKEN = 'AKIAABCDEFGHIJKLMNOP'\nx = 1  # UNRELATED\n")
        self.assertFails(self.check('--only', 'security', '--prove'),
                         'it fails for something other than security')

    def test_one_command_cannot_certify_two_gates(self):
        command = [sys.executable, 'checks/find.py', 'VIOLATION_ANY']
        self.configure(lint=command, types=command)
        self.assertFails(self.check('--only', 'lint', '--only', 'types', '--prove'),
                         'one command cannot certify unrelated gates')

    def test_specific_gates_still_prove(self):
        self.configure()
        done = self.check('--only', 'security', '--only', 'architecture', '--prove')
        self.assertPasses(done)
        self.assertIn('red on the security violation, green without it', done.stdout)


class FreshCloneTests(RunnerCase):
    def test_git_ignored_fixture_is_rejected(self):
        """Found by the from-zero run: 'build/' in .gitignore hid the build proof from CI."""
        self.git_init()
        self.manifest['source_roots'] = ['.']
        self.configure()
        self.put('.gitignore', 'build/\n')
        self.assertFails(self.check('--only', 'build', '--prove'), 'is git-ignored')

    def test_kit_gitignore_does_not_hide_proofs(self):
        self.git_init()
        self.put('.gitignore', (KIT / '.gitignore').read_text())
        self.put('.genesis/proofs/build/src/x.py.probe', 'def broken(:\n')
        done = __import__('subprocess').run(['git', '-C', str(self.root), 'check-ignore', '-q',
                                             '.genesis/proofs/build/src/x.py.probe'])
        self.assertNotEqual(done.returncode, 0, 'kit .gitignore hides the build proof')


class GeneratedProofTests(RunnerCase):
    def declare(self, verify=None):
        entry = {'pattern': 'src/private/*', 'reason': 'codegen', 'regenerate': 'make gen'}
        if verify is not None:
            entry['verify'] = verify
        self.manifest['generated'] = [entry]
        self.save()

    def test_git_version_cannot_exempt_handwritten_code(self):
        """Regression: verify=['git','--version'] exempted a 552-line hand-written file."""
        self.configure()
        self.declare(['git', '--version'])
        self.put('src/private/gen.py', 'x = 1\n' * 552)
        self.assertFails(self.guard(), 'verify must run the real generator')

    def test_header_comment_alone_no_longer_exempts(self):
        self.configure()
        self.declare()
        self.put('src/private/gen.py', '# Code generated. DO NOT EDIT.\n' + 'x = 1\n' * 552)
        self.assertFails(self.guard(), 'needs "verify"')

    def test_fake_generator_that_creates_nothing_fails(self):
        self.configure()
        self.put('gen_noop.py', 'pass\n')
        self.declare([sys.executable, 'gen_noop.py'])
        self.put('src/private/gen.py', 'x = 1\n' * 552)
        self.assertFails(self.check('--full', '--prove'), 'did not recreate them identically')
        self.assertTrue((self.root / 'src/private/gen.py').is_file(), 'original not restored')

    def test_real_generator_passes(self):
        self.configure()
        self.put('gen_real.py', "open('src/private/table.txt', 'w').write('row\\n' * 600)\n")
        self.manifest['owned_extensions'].append('.txt')
        self.declare([sys.executable, 'gen_real.py'])
        self.put('src/private/table.txt', 'row\n' * 600)
        self.assertPasses(self.check('--full', '--prove'))


class CodeownersTests(RepoCase):
    def governance(self):
        return self.tool('policy_gate.py', '--governance', '--root', str(self.root))

    def test_lookalike_paths_do_not_count(self):
        """'/.genesis-evil/' satisfies a prefix check but protects nothing on GitHub."""
        self.put('.github/CODEOWNERS', ''.join(f'/{p}-evil/ @owner\n' for p in (
            'engineering.json', '.genesis', '.github', '.claude', '.agents', '.githooks')))
        self.assertFails(self.governance(), 'gives no owner to .genesis/tools/guard.py')

    def test_later_rule_without_owner_unprotects(self):
        self.put('.github/CODEOWNERS', '* @owner\n/.genesis/ \n')
        self.assertFails(self.governance(), 'gives no owner to .genesis/tools/check.py')

    def test_nested_files_not_covered_by_single_star(self):
        self.put('.github/CODEOWNERS', '/engineering.json @o\n/.github/* @o\n/.genesis/ @o\n'
                                       '/.claude/ @o\n/.agents/ @o\n/.githooks/ @o\n')
        self.assertFails(self.governance(), 'gives no owner to .github/workflows/quality.yml')

    def test_real_ownership_passes(self):
        self.put('.github/CODEOWNERS', '* @owner\n')
        self.assertPasses(self.governance())


class SkillHonestyTests(RepoCase):
    def setUp(self):
        super().setUp()
        self.manifest['skills'] = {'required': ['feature-delivery'],
                                   'model_invocable': ['feature-delivery', 'tdd'],
                                   'user_only': ['to-spec']}
        self.save()

    def skills(self):
        return self.tool('skills_policy.py', '--check', '--root', str(self.root))

    def test_no_skills_installed_fails(self):
        """Regression: 'PASS: 0 skill copies match policy' with nothing installed."""
        self.assertFails(self.skills(), 'required skill feature-delivery is not installed')

    def test_required_missing_for_one_agent_fails(self):
        self.put('.claude/skills/feature-delivery/SKILL.md', SKILL.format(name='feature-delivery'))
        self.assertFails(self.skills(), 'not installed in .agents/skills')

    def test_optional_absent_is_fine_and_counts_are_real(self):
        for home in ('.claude', '.agents'):
            self.put(f'{home}/skills/feature-delivery/SKILL.md', SKILL.format(name='feature-delivery'))
        done = self.skills()
        self.assertPasses(done)
        self.assertIn('required 1/1 installed for 2 agent home(s); optional installed: 0', done.stdout)
