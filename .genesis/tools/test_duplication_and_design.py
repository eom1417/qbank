#!/usr/bin/env python3
"""Copy-paste guard and design-token guard: each seen failing, each seen passing."""
from __future__ import annotations

from kit_testing import RepoCase

BLOCK = ''.join(f'    total = total + price_of(item_{i}) * quantity_{i}\n' for i in range(9))
DESIGN = {'tokens': ['src/ds/tokens/*'], 'components': ['src/ds/components/*'], 'ui': ['src/*']}


class DuplicationTests(RepoCase):
    def run_guard(self):
        return self.tool('duplication.py', '--root', str(self.root))

    def test_copied_block_in_two_files_fails(self):
        self.put('src/a.py', 'def first(total):\n' + BLOCK + '    return total\n')
        self.put('src/b.py', 'def second(total):\n' + BLOCK + '    return total\n')
        self.assertFails(self.run_guard(), 'src/a.py:2 and src/b.py:2 repeat')

    def test_copy_inside_one_file_fails(self):
        self.put('src/a.py', 'def first(total):\n' + BLOCK + '    return total\n\n\n'
                             'def second(total):\n' + BLOCK + '    return total\n')
        self.assertFails(self.run_guard(), 'move the logic to one owner')

    def test_imports_comments_and_braces_are_not_clones(self):
        shared = ''.join(f'import package_{i}.module_{i}\n' for i in range(12))
        shared += '# a long explanatory comment line repeated everywhere\n' * 9
        self.put('src/a.py', shared + 'def a():\n    return 1\n')
        self.put('src/b.py', shared + 'def b():\n    return 2\n')
        self.assertPasses(self.run_guard())

    def test_clone_made_of_short_lines_fails(self):
        """Regression: a 160-character floor let a real 11-line clone of short lines through."""
        body = ('    cleaned = []\n    for row in rows:\n        value = row.strip()\n'
                '        if not value:\n            continue\n        if value.startswith("#"):\n'
                '            continue\n        cleaned.append(value.lower())\n'
                '    cleaned.sort()\n    return cleaned\n')
        self.put('src/a.py', 'def first(rows):\n' + body)
        self.put('src/b.py', 'def second(rows):\n' + body)
        self.assertFails(self.run_guard(), 'repeat')

    def test_one_owner_called_twice_passes(self):
        self.put('src/a.py', 'def owner(total):\n' + BLOCK + '    return total\n')
        self.put('src/b.py', 'from a import owner\n\n\ndef use():\n    return owner(0)\n')
        self.assertPasses(self.run_guard())

    def test_builtin_runs_in_every_gate(self):
        self.put('src/a.py', 'def first(total):\n' + BLOCK + '    return total\n')
        self.put('src/b.py', 'def second(total):\n' + BLOCK + '    return total\n')
        self.manifest['checks'] = {'lint': ['python3', 'checks/lint.py']}
        self.save()
        self.put('checks/lint.py', 'print("lint ok")\n')
        self.put('.github/CODEOWNERS', '* @owner\n')
        done = self.tool('check.py', '--root', str(self.root), '--only', 'lint', '--prove')
        self.assertFails(done, 'copy-paste')


class DesignTests(RepoCase):
    def setUp(self):
        super().setUp()
        self.manifest['owned_extensions'] += ['.tsx', '.css']
        self.manifest['applies'] = {'design': True}
        self.manifest['design_system'] = DESIGN
        self.save()
        self.put('src/ds/tokens/primitives.ts', "export const red500 = '#ef4444';\n")
        self.put('src/ds/components/Button.tsx', 'export const Button = () => <button />;\n')

    def run_guard(self):
        return self.tool('design_guard.py', '--root', str(self.root))

    def test_raw_values_in_a_feature_fail(self):
        for text, label in (("const c = { color: '#ff0000' };", 'raw color'),
                            ("const s = 'rgb(1, 2, 3)';", 'raw color function'),
                            ("const w = '12px';", 'raw size'),
                            ('const el = <div className="p-[13px]" />;', 'Tailwind arbitrary'),
                            ("const f = { fontFamily: 'Inter' };", 'raw font family'),
                            ('const z = { zIndex: 10 };', 'raw z-index'),
                            ('const p = { padding: 8 };', 'raw spacing number'),
                            ('const b = <button>Go</button>;', 'native control')):
            with self.subTest(label=label):
                self.put('src/features/View.tsx', text + '\n')
                self.assertFails(self.run_guard(), label)

    def test_css_color_without_digits_fails(self):
        self.put('src/features/view.css', '.x { color: #fff; }\n')
        self.assertFails(self.run_guard(), 'raw color')

    def test_tokens_components_and_clean_features_pass(self):
        self.put('src/features/View.tsx', 'import { Button } from "../ds";\n'
                 'const v = <Button tone="danger">Go</Button>;\n'
                 'const link = <a href="#add">add</a>;\n// #ff0000 in a comment\n')
        self.put('src/features/view.css', '.x { padding: var(--space-4); margin: 0; }\n')
        self.assertPasses(self.run_guard())

    def test_design_on_without_configuration_fails(self):
        del self.manifest['design_system']
        self.save()
        self.assertFails(self.run_guard(), 'add "design_system"')

    def test_design_off_checks_nothing(self):
        self.manifest['applies'] = {'design': False}
        self.save()
        self.put('src/features/View.tsx', "const c = '#ff0000';\n")
        self.assertPasses(self.run_guard())
