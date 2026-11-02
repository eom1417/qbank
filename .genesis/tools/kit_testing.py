"""Shared fixture for the kit's self-tests: a disposable repository per test."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from layout import PROJECT_ROOT
from toolchain import lizard_command

TOOLS = Path(__file__).resolve().parent
KIT = PROJECT_ROOT


def lizard_available() -> bool:
    return lizard_command() is not None


class RepoCase(unittest.TestCase):
    """Temporary project with a ready manifest and one valid authored file."""

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        self.manifest = {
            'project': 'fixture', 'ready': True, 'source_roots': ['src'],
            'owned_extensions': ['.py', '.ts', '.sh', '.md', '.json', '.dart'],
            'owned_filenames': ['Dockerfile*', '.gitignore', 'CODEOWNERS'], 'generated': [], 'checks': {},
        }
        self.save()
        self.put('src/app.py', 'def small():\n    return 1\n')

    def save(self):
        (self.root / 'engineering.json').write_text(json.dumps(self.manifest))

    def put(self, rel: str, text: str) -> Path:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        return path

    def git_init(self):
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)

    def tool(self, name: str, *args: str, stdin: str = '', env: dict | None = None):
        command = [sys.executable, str(TOOLS / name), *args]
        return subprocess.run(command, capture_output=True, text=True, input=stdin, env=env)

    def guard(self, *args: str):
        return self.tool('guard.py', '--root', str(self.root), *args)

    def assertFails(self, done, needle: str = ''):
        self.assertNotEqual(done.returncode, 0, done.stdout + done.stderr)
        self.assertIn(needle, done.stdout + done.stderr)

    def assertPasses(self, done):
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)


def python_function(lines: int) -> str:
    """A Python function spanning exactly `lines` physical lines."""
    return 'def sized():\n' + '    x = 1\n' * (lines - 2) + '    return x\n'


def python_branches(branches: int) -> str:
    """A Python function with cyclomatic complexity 1 + branches."""
    body = ''.join(f'    if x == {i}:\n        return {i}\n' for i in range(branches))
    return 'def branchy(x):\n' + body + '    return -1\n'


def ts_function(lines: int) -> str:
    body = ''.join(f'  const v{i} = {i};\n' for i in range(lines - 3))
    return 'export function sized(): number {\n' + body + '  return 1;\n}\n'


def ts_branches(branches: int) -> str:
    body = ''.join(f'  if (x === {i}) {{ return {i}; }}\n' for i in range(branches))
    return 'export function branchy(x: number): number {\n' + body + '  return -1;\n}\n'
