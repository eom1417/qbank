#!/usr/bin/env python3
"""Self-tests for the gate runner and proofs: no gate counts until seen failing."""
from __future__ import annotations

import json
import subprocess
import sys
import unittest

from check import FAST, FULL, command_problem
from kit_testing import TOOLS, RepoCase, python_branches, python_function

REAL = [sys.executable, str(TOOLS / 'guard.py'), '--functions', '--root', '.']
FAKE = ['git', 'status', '--short']


class CommandValidationTests(unittest.TestCase):
    def test_obvious_fakes_rejected_before_running(self):
        fakes = (['echo', 'PASS'], ['true'], ['env', 'CI=1', 'true'], ['python3', '-c', 'pass'],
                 ['node', '-e', '0'], ['bash', '-c', 'exit 0'], ['npm', 'run', 'TODO'], [], 'lint',
                 ['eslint', '.genesis/proofs/lint'], ['cat', '.genesis/proofs.json'])
        for fake in fakes:
            with self.subTest(fake=fake):
                self.assertIsNotNone(command_problem('lint', fake))

    def test_real_commands_accepted(self):
        for real in (['npx', 'eslint', '.'], ['python3', '.genesis/tools/guard.py', '--functions'],
                     ['env', 'CI=1', 'pytest', '-q']):
            with self.subTest(real=real):
                self.assertIsNone(command_problem('lint', real))


FIND = """import pathlib, re, sys
pattern = re.compile(sys.argv[1], re.M)
bad = [p for p in sorted(pathlib.Path('src').rglob('*.py')) if pattern.search(p.read_text())]
for p in bad:
    print(f'{p}: violation')
sys.exit(1 if bad else 0)
"""
DUP = """import pathlib, sys
def windows(p):
    lines = [l.strip() for l in p.read_text().splitlines() if l.strip()]
    return {tuple(lines[i:i + 6]) for i in range(len(lines) - 5)}
files = sorted(pathlib.Path('src').rglob('*.py'))
bad = {str(b) for a in files for b in files if a < b and windows(a) & windows(b)}
print('\\n'.join(sorted(bad)))
sys.exit(1 if bad else 0)
"""
DUPLICATE = 'def copied(rows):\n' + ''.join(f'    step{i} = rows[{i}]\n' for i in range(7)) + \
    '    return step0\n'


class RunnerCase(RepoCase):
    """Each gate gets a small but real checker for its own kind of violation."""

    def gate_setup(self, name: str):
        py = sys.executable
        table = {
            'function_length': (REAL, {'probe_long.py': python_function(60)}),
            'complexity': (REAL, {'probe_branchy.py': python_branches(10)}),
            'architecture': ([py, 'checks/find.py', r'^from forbidden_layer'],
                             {'probe_arch.py': 'from forbidden_layer import thing\n'}),
            'security': ([py, 'checks/find.py', r'AKIA[0-9A-Z]{16}'],
                         {'probe_sec.py': "TOKEN = 'AKIAABCDEFGHIJKLMNOP'\n"}),
            'duplication': ([py, 'checks/dup.py'],
                            {'probe_dup_a.py': DUPLICATE, 'probe_dup_b.py': DUPLICATE}),
        }
        marker = f'VIOLATION_{name.upper()}'
        return table.get(name, ([py, 'checks/find.py', marker],
                                {f'probe_{name}.py': f'x = 1  # {marker}\n'}))

    def configure(self, gates=FULL, **overrides):
        self.put('checks/find.py', FIND)
        self.put('checks/dup.py', DUP)
        self.manifest['checks'] = {}
        for name in gates:
            command, files = self.gate_setup(name)
            self.manifest['checks'][name] = command
            for filename, text in files.items():
                self.put(f'.genesis/proofs/{name}/src/{filename}.probe', text)
        self.manifest['checks'].update(overrides)
        self.save()
        self.put('.github/CODEOWNERS', '* @owner\n')

    def check(self, *args: str):
        return self.tool('check.py', '--root', str(self.root), *args)


class ProofTests(RunnerCase):
    def test_unconfigured_fails(self):
        self.assertFails(self.check(), 'no command configured')

    def test_not_ready_fails(self):
        self.configure()
        self.manifest['ready'] = False
        self.save()
        self.assertFails(self.check(), 'Bootstrap incomplete')

    def test_real_gates_prove_then_fast_path_passes(self):
        self.configure()
        self.assertFails(self.check(), 'unproven')
        proved = self.check('--prove')
        self.assertPasses(proved)
        self.assertIn('PROVED', proved.stdout)
        self.assertPasses(self.check())
        self.assertFalse((self.root / 'src' / 'probe_lint.py').exists(), 'fixture not restored')

    def test_reviewer_git_status_attack_is_rejected(self):
        self.git_init()
        self.manifest['source_roots'] = ['.']
        self.configure(lint=FAKE)
        done = self.check('--prove')
        self.assertFails(done, 'still PASSES with the violation planted')

    def test_gate_without_fixture_is_unproven(self):
        self.configure()
        (self.root / '.genesis/proofs/lint/src/probe_lint.py.probe').unlink()
        self.assertFails(self.check('--prove'), 'never been seen failing')

    def test_changing_a_command_invalidates_its_proof(self):
        self.configure()
        self.assertPasses(self.check('--prove'))
        self.manifest['checks']['lint'] = self.manifest['checks']['lint'] + ['src']
        self.save()
        self.assertFails(self.check(), 'lint: unproven')

    def test_failing_for_another_reason_is_not_a_proof(self):
        broken = [sys.executable, str(TOOLS / 'guard.py'), '--root', '/nonexistent']
        self.configure(lint=broken)
        self.assertFails(self.check('--prove'))

    def test_every_code_language_needs_a_fixture(self):
        self.configure()
        self.put('src/run.sh', 'echo hi\n')
        self.assertFails(self.check('--prove'), 'no proof fixture for .sh')

    def test_fixture_cannot_target_policy_files(self):
        self.configure()
        self.put('.genesis/proofs/lint/engineering.json.probe', '{}')
        self.assertFails(self.check('--prove'), 'may not target engineering.json')

    def test_interrupted_proof_is_recovered(self):
        self.configure()
        journal = {'planted': ['src/left.py'], 'backups': {}, 'dirs': []}
        self.put('src/left.py', python_function(60))
        self.put('.genesis/proof-journal.json', json.dumps(journal))
        done = self.check('--prove')
        self.assertIn('RECOVERED', done.stdout)
        self.assertFalse((self.root / 'src' / 'left.py').exists())

    def test_replaced_file_is_restored_byte_for_byte(self):
        self.configure()
        self.put('.genesis/proofs/lint/src/app.py.probe', 'x = 1  # VIOLATION_LINT\n')
        self.assertPasses(self.check('--prove'))
        self.assertEqual((self.root / 'src' / 'app.py').read_text(), 'def small():\n    return 1\n')


class GovernanceTests(RunnerCase):
    def test_missing_or_placeholder_codeowners_blocks(self):
        self.configure()
        (self.root / '.github' / 'CODEOWNERS').write_text('/.genesis/ @CONFIGURE_ME\n')
        self.assertFails(self.check('--prove'), 'replace @CONFIGURE_ME')
        (self.root / '.github' / 'CODEOWNERS').unlink()
        self.assertFails(self.check('--prove'), 'no CODEOWNERS')

    def test_policy_change_needs_label_in_ci(self):
        self.git_init()
        git = ['git', '-C', str(self.root), '-c', 'user.email=a@b', '-c', 'user.name=t']
        subprocess.run(git + ['add', '-A'], check=True)
        subprocess.run(git + ['commit', '-qm', 'base'], check=True)
        self.put('.genesis/tools/guard_rules.py', 'MAX_FILE_LINES = 4000\n')
        subprocess.run(git + ['add', '-A'], check=True)
        subprocess.run(git + ['commit', '-qm', 'weaken'], check=True)
        gate = ['policy_gate.py', '--root', str(self.root), '--base', 'HEAD~1']
        self.assertFails(self.tool(*gate, '--labels', ''), 'policy-change')
        self.assertPasses(self.tool(*gate, '--labels', 'policy-change'))


class RunnerTests(RunnerCase):
    def test_missing_tool_is_blocked(self):
        self.configure(types=['definitely-not-installed-tool-xyz'])
        self.assertFails(self.check('--prove'), 'BLOCKED')

    def test_full_requires_full_gates(self):
        self.configure(gates=FAST)
        self.assertFails(self.check('--full'), 'unit: no command configured')

    def test_applies_flag_turns_on_the_design_guard(self):
        self.configure()
        self.manifest['applies'] = {'design': True}
        self.save()
        self.assertFails(self.check('--prove'), 'add "design_system"')

    def test_builtin_guard_cannot_be_skipped(self):
        self.configure()
        self.put('src/app.py', 'x = 1\n' * 401)
        self.assertFails(self.check('--only', 'lint', '--prove'), 'authored-file-limits')

    def test_precommit_hook_before_bootstrap_checks_staged_files(self):
        self.manifest['ready'] = False
        self.save()
        self.git_init()
        self.put('src/app.py', 'x = 1\n' * 401)
        subprocess.run(['git', '-C', str(self.root), 'add', 'src/app.py'], check=True)
        self.assertFails(self.check('--hook', 'pre-commit'), '401 physical lines')


class BootstrapEnvTests(RepoCase):
    def test_ci_setup_requires_pinned_setup_commands(self):
        self.assertFails(self.tool('bootstrap_env.py', '--ci', '--root', str(self.root)),
                         'BOOTSTRAP REQUIRED')

    def test_ci_setup_rejects_fake_setup(self):
        self.manifest['setup'] = [['echo', 'installed']]
        self.save()
        self.assertFails(self.tool('bootstrap_env.py', '--ci', '--root', str(self.root)), 'no-op')


if __name__ == '__main__':
    unittest.main()
