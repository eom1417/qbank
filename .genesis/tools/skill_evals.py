#!/usr/bin/env python3
"""Ask the real agent and record which skill it loads (no slash, plain chat).

  genesis.py skills --evals   (cases: .genesis/tools/skill_evals.json)
Needs the Claude Code CLI signed in. Costs a few cents per case; not part of CI.
by_name and must_not (explicit-only skills stay unloaded) must all pass; implicit >= 80%.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from layout import PROJECT_ROOT

ROOT = PROJECT_ROOT


def skills_loaded(prompt: str, root: Path) -> list[str] | None:
    command = ['claude', '-p', prompt, '--output-format', 'stream-json', '--verbose',
               '--max-turns', '1']
    try:
        done = subprocess.run(command, cwd=root, capture_output=True, text=True, timeout=240)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return [use['input'].get('skill', '') for use in _tool_uses(done.stdout)
            if use.get('name') == 'Skill']


def _tool_uses(stream: str) -> list[dict]:
    uses = []
    for line in stream.splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if event.get('type') == 'assistant':
            uses += [c for c in event['message'].get('content', []) if c.get('type') == 'tool_use']
    return uses


def run(cases: list[dict], root: Path) -> dict[str, list[bool]]:
    results: dict[str, list[bool]] = {'by_name': [], 'implicit': []}
    for case in cases:
        loaded = skills_loaded(case['prompt'], root)
        hit = loaded is not None and any(s.split(':')[-1] == case['expect'] for s in loaded)
        ok = (loaded is not None and not hit) if case['kind'] == 'must_not' else hit
        results.setdefault(case['kind'], []).append(ok)
        print(f'{"PASS" if ok else "FAIL"} [{case["kind"]}] expect {case["expect"]:<22} '
              f'loaded {loaded}  <- {case["prompt"][:60]}', flush=True)
    return results


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--cases', type=Path, default=Path(__file__).resolve().parent / 'skill_evals.json')
    parser.add_argument('--root', type=Path, default=ROOT)
    args = parser.parse_args(argv)
    if not shutil.which('claude'):
        print('BLOCKED: Claude Code CLI not found; skill routing is unverified')
        return 1
    cases = json.loads(args.cases.read_text(encoding='utf-8'))['cases']
    results = run(cases, args.root.resolve())
    named, implicit = results['by_name'] + results.get('must_not', []), results['implicit']
    rate = sum(implicit) / len(implicit) if implicit else 1.0
    print(f'by_name {sum(named)}/{len(named)} · implicit {sum(implicit)}/{len(implicit)} ({rate:.0%})')
    return 0 if all(named) and rate >= 0.8 else 1


if __name__ == '__main__':
    raise SystemExit(main())
