#!/usr/bin/env python3
"""Bypasses that once produced a false PASS stay closed (each test replays the attack)."""
from __future__ import annotations

import os
import unittest

from kit_testing import RepoCase, ts_function


class SuppressionBanTests(RepoCase):
    MARKERS = (
        'import os  # ' + 'noqa: F401', '// eslint' + '-disable-next-line @typescript-eslint/x',
        'x = 1  # type' + ': ignore', '// @ts' + '-expect-error', '// @ts' + '-ignore',
        '#[' + 'allow(dead_code)]', '# pragma' + ': no cover', '# no' + 'sec', '// pre' + 'ttier-ignore',
        '/* istanbul ' + 'ignore next */', '# pylint' + ': disable=unused-import',
        '// rubocop' + ':disable Style/X', '// NO' + 'LINT', '@Suppress' + 'Warnings("unchecked")',
        '#pragma warning ' + 'disable CS0168', '// shell' + 'check disable=SC2086',
        '// ig' + 'nore: unused_import', '@phpstan' + '-ignore-next-line',
    )

    def test_every_inline_suppression_rejected(self):
        for marker in self.MARKERS:
            with self.subTest(marker=marker):
                self.put('src/app.py', f'x = 1\n{marker}\n')
                self.assertFails(self.guard(), 'forbidden')

    def test_agent_quick_mode_rejects_them_too(self):
        bad = self.put('src/app.py', 'import os  # ' + 'noqa: F401\n')
        self.assertFails(self.guard('--files', str(bad)), 'noqa')


class ClassificationTests(RepoCase):
    def test_unknown_extension_cannot_hide(self):
        self.put('src/report.qmd', 'line\n' * 1000)
        self.assertFails(self.guard(), 'unclassified')

    def test_declared_extension_is_then_limited(self):
        self.manifest['owned_extensions'].append('.qmd')
        self.save()
        self.put('src/report.qmd', 'line\n' * 1000)
        self.assertFails(self.guard(), '1000 physical lines')

    def test_known_assets_and_lockfiles_pass(self):
        self.put('src/logo.png', 'binary')
        self.put('src/yarn.lock', 'x\n' * 900)
        self.assertPasses(self.guard())

    def test_lock_entry_without_source_is_not_vendor(self):
        self.manifest['source_roots'] = ['.']
        self.save()
        self.put('skills-lock.json', '{"skills": {"evil": {}}}')
        self.put('.agents/skills/evil/SKILL.md', 'x\n' * 900)
        self.assertFails(self.guard(), '900 physical lines')


class NoSilentPassTests(RepoCase):
    def test_quick_mode_blocks_when_measuring_tool_missing(self):
        bad = self.put('src/a.ts', ts_function(60))
        env = dict(os.environ, GENESIS_SIMULATE_MISSING_LIZARD='1')
        done = self.tool('guard.py', '--root', str(self.root), '--files', str(bad), env=env)
        self.assertFails(done, 'BLOCKED')

    def test_quick_mode_blocks_unmeasurable_language(self):
        dart = self.put('src/main.dart', 'void main() {}\n')
        self.assertFails(self.guard('--files', str(dart)), 'BLOCKED')


class RecipeTests(RepoCase):
    def test_recipe_templates_are_inert(self):
        self.manifest['source_roots'] = ['.']
        self.save()
        self.put('.genesis/recipes/x/eslint.config.mjs.recipe', 'export default [];\n')
        self.put('.genesis/recipes/x/proofs/lint/src/bad.ts.probe', '// eslint' + '-disable\n')
        self.assertPasses(self.guard())

    def test_recipe_apply_fills_placeholders_and_gates(self):
        self.put('.genesis/recipes/demo/recipe.json',
                 '{"setup": [["pip", "install", "x"]], "checks": {"lint": ["ruff", "src/__PKG__"]}}')
        self.put('.genesis/recipes/demo/.importlinter.recipe', 'root_package = __PKG__\n')
        self.put('.genesis/recipes/demo/proofs/lint/src/__PKG__/bad.py.probe', 'import os\n')
        done = self.tool('bootstrap_env.py', '--recipe', 'demo', '--var', 'PKG=billing',
                         '--root', str(self.root))
        self.assertPasses(done)
        self.assertEqual((self.root / '.importlinter').read_text(), 'root_package = billing\n')
        self.assertTrue((self.root / '.genesis/proofs/lint/src/billing/bad.py.probe').is_file())
        self.assertIn('src/billing', (self.root / 'engineering.json').read_text())

    def test_recipe_refuses_unfilled_placeholders(self):
        self.put('.genesis/recipes/demo/recipe.json', '{"checks": {"lint": ["ruff", "__PKG__"]}}')
        done = self.tool('bootstrap_env.py', '--recipe', 'demo', '--root', str(self.root))
        self.assertFails(done, 'unfilled placeholder')


if __name__ == '__main__':
    unittest.main()
