"""The kit's own tools (lizard and its pinned dependencies): find them, install them.

Installs into .genesis/.pylib with hash-locked wheels, so it works on PEP 668 system
Pythons (Debian/Ubuntu), in CI and on macOS/Windows without creating a virtualenv.
Order: pip --target with --require-hashes; if pip is missing, a stdlib download of the
same wheels from PyPI, verified against the same hashes.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
LIB = TOOLS.parent / '.pylib'  # next to the tools that use it, whatever tree they measure
REQUIREMENTS = TOOLS / 'requirements-guard.txt'
PIN = re.compile(r'^([A-Za-z0-9_.-]+)==([\w.]+)\s+--hash=sha256:([0-9a-f]{64})\s*$')
PYPI = 'https://pypi.org/pypi/{name}/{version}/json'


def kit_env() -> dict[str, str]:
    """Environment in which `python -m lizard` sees the kit-local install."""
    env = dict(os.environ)
    if LIB.is_dir():
        env['PYTHONPATH'] = os.pathsep.join(filter(None, [str(LIB), env.get('PYTHONPATH')]))
    return env


def lizard_command() -> list[str] | None:
    if os.environ.get('GENESIS_SIMULATE_MISSING_LIZARD') == '1':  # self-tests only; can only fail
        return None
    probe = subprocess.run([sys.executable, '-c', 'import lizard'], capture_output=True,
                           env=kit_env(), check=False)
    if probe.returncode == 0:
        return [sys.executable, '-m', 'lizard']
    exe = shutil.which('lizard')
    return [exe] if exe else None


def pins() -> list[tuple[str, str, str]]:
    lines = REQUIREMENTS.read_text(encoding='utf-8').splitlines()
    return [m.groups() for m in map(PIN.match, lines) if m]


def ensure() -> list[str]:
    """Install the kit tools if they are missing; return problems (empty = ready)."""
    if lizard_command() is not None:
        return []
    LIB.mkdir(parents=True, exist_ok=True)
    if not _pip_install(LIB):
        problems = _download_install(pins(), LIB)
        if problems:
            return problems
    if lizard_command() is None:
        return [f'kit tools installed into {LIB} but lizard still cannot be imported']
    return []


def _pip_install(target: Path) -> bool:
    command = [sys.executable, '-m', 'pip', 'install', '--quiet', '--disable-pip-version-check',
               '--no-deps', '--require-hashes', '--upgrade', '--target', str(target),
               '-r', str(REQUIREMENTS)]
    try:
        done = subprocess.run(command, capture_output=True, text=True, check=False)
    except OSError:
        return False
    return done.returncode == 0


def _download_install(wanted: list[tuple[str, str, str]], target: Path) -> list[str]:
    """No pip: fetch each pinned wheel from PyPI, verify its sha256, unpack it."""
    problems = []
    for name, version, sha in wanted:
        try:
            data = _fetch_wheel(name, version, sha)
        except (OSError, ValueError) as exc:
            problems.append(f'cannot install {name}=={version}: {exc}')
            continue
        with tempfile.TemporaryFile() as handle:
            handle.write(data)
            zipfile.ZipFile(handle).extractall(target)
    return problems


def _fetch_wheel(name: str, version: str, sha: str) -> bytes:
    with urllib.request.urlopen(PYPI.format(name=name, version=version), timeout=60) as reply:
        files = json.load(reply).get('urls', [])
    url = next((f['url'] for f in files if f.get('digests', {}).get('sha256') == sha), None)
    if url is None:
        raise ValueError('no file on PyPI matches the pinned hash')
    with urllib.request.urlopen(url, timeout=120) as reply:
        data = reply.read()
    if hashlib.sha256(data).hexdigest() != sha:
        raise ValueError('downloaded file does not match the pinned hash')
    return data
