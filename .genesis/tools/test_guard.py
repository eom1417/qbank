#!/usr/bin/env python3
"""Negative-first self-tests: every hard limit must be able to fail."""
from __future__ import annotations

import unittest

from guard_core import git_listing, walk_listing
from guard_rules import LIZARD_EXTS, suffix_of

from kit_testing import (KIT, RepoCase, lizard_available, python_branches, python_function,
                         ts_branches, ts_function)


class FileLimitTests(RepoCase):
    def test_valid_project_passes(self):
        self.assertPasses(self.guard())

    def test_rules_apply_before_bootstrap_too(self):
        self.manifest['ready'] = False
        self.save()
        self.put('src/app.py', 'x = 1\n' * 401)
        self.assertFails(self.guard(), '401 physical lines')

    def test_400_lines_pass_and_401_fail(self):
        self.put('src/app.py', 'x = 1\n' * 400)
        self.assertPasses(self.guard())
        self.put('src/app.py', 'x = 1\n' * 401)
        self.assertFails(self.guard(), '401 physical lines')

    def test_docs_and_config_are_limited_too(self):
        self.put('src/guide.md', 'line\n' * 401)
        self.assertFails(self.guard(), 'guide.md')

    def test_extensionless_owned_filename_is_limited(self):
        self.put('src/Dockerfile.dev', 'RUN true\n' * 401)
        self.assertFails(self.guard(), 'Dockerfile.dev')

    def test_symlink_rejected(self):
        self.put('outside.py', 'x = 1\n')
        (self.root / 'src' / 'link.py').symlink_to(self.root / 'outside.py')
        self.assertFails(self.guard(), 'symlink')

    def test_missing_sources_fail(self):
        (self.root / 'src' / 'app.py').unlink()
        self.assertFails(self.guard(), 'No authored files')

    def test_root_traversal_rejected(self):
        self.manifest['source_roots'] = ['../outside']
        self.save()
        self.assertFails(self.guard(), 'Invalid or missing source root')


class DiscoveryTests(RepoCase):
    def test_git_file_outside_roots_fails(self):
        self.git_init()
        self.put('extra.py', 'x = 1\n')
        self.assertFails(self.guard(), 'outside declared source_roots')

    def test_whole_repo_root_covers_everything(self):
        self.git_init()
        self.manifest['source_roots'] = ['.']
        self.save()
        self.put('extra.py', 'x = 1\n')
        self.assertPasses(self.guard())

    def test_gitignored_dependencies_are_skipped(self):
        self.git_init()
        self.manifest['source_roots'] = ['.']
        self.save()
        self.put('.gitignore', 'node_modules/\n')
        self.put('node_modules/pkg/index.json', '{}\n' * 900)
        self.assertPasses(self.guard())

    def test_walk_fallback_prunes_dependencies(self):
        self.manifest['source_roots'] = ['.']
        self.save()
        self.put('node_modules/pkg/big.py', 'x = 1\n' * 900)
        self.assertPasses(self.guard())

    def test_declared_generated_lockfile_excluded(self):
        self.manifest['source_roots'] = ['.']
        self.save()
        self.put('package-lock.json', '{}\n' * 900)
        self.assertPasses(self.guard())

    def test_overbroad_generated_pattern_rejected(self):
        self.manifest['generated'] = [{'pattern': 'src/*', 'reason': 'x', 'regenerate': 'y'}]
        self.save()
        self.assertFails(self.guard(), 'too broad')

    def test_generated_entry_needs_reason_and_command(self):
        self.manifest['generated'] = [{'pattern': 'gen/api.json'}]
        self.save()
        self.assertFails(self.guard(), 'missing')

    def test_locked_third_party_skill_is_vendor(self):
        self.manifest['source_roots'] = ['.']
        self.save()
        self.put('skills-lock.json', '{"skills": {"tdd": {"source": "o/r"}, '
                                     '"feature-delivery": {"source": "o/r"}}}')
        self.put('.agents/skills/tdd/SKILL.md', 'x\n' * 900)
        self.assertPasses(self.guard())
        self.put('.agents/skills/feature-delivery/SKILL.md', 'x\n' * 900)
        self.assertFails(self.guard(), 'feature-delivery')


class BypassTests(RepoCase):
    MARKERS = (
        '# ' + 'noqa', 'x = 1  # ' + 'no' + 'qa: C901', '# ' + 'liz' + 'ard forgives',
        '// eslint' + '-disable', '/* eslint' + '-disable complexity */',
        '// eslint' + '-disable-next-line max-lines-per-function', '//' + 'nolint',
        '//' + 'no' + 'lint:gocyclo', '#[' + 'allow(clippy::too_many_lines)]',
        '// swift' + 'lint:disable function_body_length', '// NO' + 'SONAR',
        '@Suppress' + 'Warnings("CyclomaticComplexity")', '"complex' + 'ity": "off",',
        'max-' + 'complexity = 25', '# py' + 'lint: disable=too-many-branches',
    )

    def test_every_bypass_marker_rejected(self):
        for marker in self.MARKERS:
            with self.subTest(marker=marker):
                self.put('src/app.py', f'x = 1\n{marker}\n')
                self.assertFails(self.guard(), 'raised' if 'complexity =' in marker else 'forbidden')

    def test_docs_may_mention_markers(self):
        self.put('src/notes.md', 'Never write # ' + 'noqa or eslint' + '-disable.\n')
        self.assertPasses(self.guard())


class FunctionTests(RepoCase):
    def test_python_50_lines_pass_51_fail(self):
        self.put('src/app.py', python_function(50))
        self.assertPasses(self.guard('--functions'))
        self.put('src/app.py', python_function(51))
        self.assertFails(self.guard('--functions'), '51 lines')

    def test_decorators_count_as_function_lines(self):
        self.put('src/app.py', '@staticmethod\n' * 49 + 'def f():\n    return 1\n')
        self.assertFails(self.guard('--functions'), '51 lines')

    def test_python_complexity_10_pass_11_fail(self):
        self.put('src/app.py', python_branches(9))
        self.assertPasses(self.guard('--functions'))
        self.put('src/app.py', python_branches(10))
        self.assertFails(self.guard('--functions'), 'complexity 11')

    def test_boolean_operators_count(self):
        conditions = ' and '.join(f'x{i}' for i in range(11))
        self.put('src/app.py', f'def f({", ".join(f"x{i}" for i in range(11))}):\n'
                               f'    return {conditions}\n')
        self.assertFails(self.guard('--functions'), 'complexity 11')

    def test_nested_function_measured_separately(self):
        inner = python_branches(6).replace('\n', '\n    ').rstrip() + '\n'
        text = 'def outer(x):\n    if x:\n        return 1\n    ' + inner + '    return branchy\n'
        self.put('src/app.py', text)
        self.assertPasses(self.guard('--functions'))

    def test_shell_is_bounded_as_one_function(self):
        self.put('src/run.sh', '#!/bin/sh\n' + 'echo hi\n' * 50)
        self.assertFails(self.guard('--functions'), 'shell file is 51 lines')
        self.put('src/run.sh', ''.join(f'[ -f f{i} ] && echo {i}\n' for i in range(10)))
        self.assertFails(self.guard('--functions'), 'branching 11')

    def test_language_without_gate_is_blocked(self):
        self.put('src/main.dart', 'void main() {}\n')
        self.assertFails(self.guard('--functions'), 'no function/complexity gate for .dart')
        self.manifest['external_function_gates'] = ['.dart']
        self.save()
        self.assertPasses(self.guard('--functions'))

    @unittest.skipUnless(lizard_available(), 'lizard not installed')
    def test_typescript_limits_via_lizard(self):
        self.put('src/a.ts', ts_function(50))
        self.assertPasses(self.guard('--functions'))
        self.put('src/a.ts', ts_function(51))
        self.assertFails(self.guard('--functions'), 'sized')
        self.put('src/a.ts', ts_branches(9))
        self.assertPasses(self.guard('--functions'))
        self.put('src/a.ts', ts_branches(10))
        self.assertFails(self.guard('--functions'), '11 CCN')

    def test_quick_files_mode_works_before_bootstrap(self):
        self.manifest['ready'] = False
        self.save()
        bad = self.put('src/bad.py', python_function(60))
        self.assertFails(self.guard('--files', str(bad)), '60 lines')
        self.assertPasses(self.guard('--files', str(self.root / 'src' / 'app.py')))


class KitComplianceTests(RepoCase):
    """The kit obeys its own rules (dogfooding)."""

    def test_kit_files_within_limits(self):
        listing = git_listing(KIT)
        names = listing if listing is not None else walk_listing(KIT, ['.'])
        measurable = lizard_available() or (lambda n: suffix_of(n) not in LIZARD_EXTS)
        files = [str(KIT / name) for name in names
                 if (KIT / name).is_file() and (measurable is True or measurable(name))]
        done = self.tool('guard.py', '--root', str(KIT), '--files', *files)
        self.assertPasses(done)


if __name__ == '__main__':
    unittest.main()
