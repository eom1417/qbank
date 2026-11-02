#!/usr/bin/env python3
"""Layer 5 on GitHub in one command: the policy-change label and branch protection.

  github_setup.py --plan     print what would change (read-only; the default)
  github_setup.py --apply    create the label and protect the default branch (needs the
                             owner's approval: it changes the GitHub repository)
  github_setup.py --verify   read the live protection back and compare it with the plan

Uses the GitHub CLI (`gh`, signed in with admin rights on the repository). Profiles:
team (2+ collaborators) requires a Code Owner review; solo cannot (GitHub does not let an
author approve their own PR), so it requires the CI check, linear safety and no force push.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys

CHECK_NAME = 'Engineering quality'
LABEL = ('policy-change', 'B60205', 'Owner-approved change to guards, CI or agent rules')


def gh(*args: str, stdin: str | None = None) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(['gh', *args], capture_output=True, text=True, input=stdin,
                              check=False)
    except OSError as exc:
        return subprocess.CompletedProcess(['gh'], 127, '', f'gh not found: {exc}')


def repository() -> tuple[str, str] | str:
    done = gh('repo', 'view', '--json', 'nameWithOwner,defaultBranchRef')
    if done.returncode:
        return f'cannot read the repository with gh: {done.stderr.strip()[:200]}'
    data = json.loads(done.stdout)
    return data['nameWithOwner'], data['defaultBranchRef']['name']


def is_team(repo: str) -> bool:
    done = gh('api', f'repos/{repo}/collaborators', '--jq', 'length')
    return done.returncode == 0 and done.stdout.strip().isdigit() and int(done.stdout) > 1


def protection(team: bool) -> dict:
    reviews = {'require_code_owner_reviews': True, 'required_approving_review_count': 1,
               'dismiss_stale_reviews': True} if team else None
    return {
        'required_status_checks': {'strict': True, 'contexts': [CHECK_NAME]},
        'enforce_admins': False,
        'required_pull_request_reviews': reviews,
        'restrictions': None,
        'allow_force_pushes': False,
        'allow_deletions': False,
        'required_conversation_resolution': True,
    }


def plan() -> tuple[list[tuple[str, list[str], str | None]], str]:
    found = repository()
    if isinstance(found, str):
        return [], found
    repo, branch = found
    body = protection(is_team(repo))
    profile = 'team' if body['required_pull_request_reviews'] else 'solo'
    name, color, text = LABEL
    steps = [
        (f'label "{name}" on {repo}',
         ['label', 'create', name, '--color', color, '--description', text, '--force'], None),
        (f'protect {repo}:{branch} ({profile}: required check "{CHECK_NAME}", no force push)',
         ['api', '-X', 'PUT', f'repos/{repo}/branches/{branch}/protection', '--input', '-'],
         json.dumps(body)),
    ]
    return steps, ''


def verify() -> list[str]:
    found = repository()
    if isinstance(found, str):
        return [found]
    repo, branch = found
    done = gh('api', f'repos/{repo}/branches/{branch}/protection')
    if done.returncode:
        return [f'{branch} is not protected (run --apply after the owner approves)']
    live = json.loads(done.stdout)
    contexts = live.get('required_status_checks', {}).get('contexts', [])
    problems = [] if CHECK_NAME in contexts else [f'required check "{CHECK_NAME}" is missing']
    if live.get('allow_force_pushes', {}).get('enabled'):
        problems.append('force pushes are allowed')
    labels = gh('label', 'list', '--json', 'name', '--jq', '.[].name').stdout.split()
    return problems + ([] if LABEL[0] in labels else [f'label "{LABEL[0]}" is missing'])


def run(apply: bool) -> int:
    steps, problem = plan()
    if problem:
        print(f'BLOCKED: {problem}')
        return 1
    for title, args, stdin in steps:
        if not apply:
            print(f'PLAN: {title}\n      gh {" ".join(args)}')
            continue
        done = gh(*args, stdin=stdin)
        print(f'{"DONE" if done.returncode == 0 else "FAIL"}: {title}')
        if done.returncode:
            print(f'      {done.stderr.strip()[:300]}')
            return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--plan', action='store_true')
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--verify', action='store_true')
    args = parser.parse_args(argv)
    if not args.verify:
        return run(args.apply)
    problems = verify()
    for problem in problems:
        print(f'FAIL: {problem}', file=sys.stderr)
    print('FAIL: governance not live' if problems else 'PASS: label and branch protection live')
    return 1 if problems else 0


if __name__ == '__main__':
    raise SystemExit(main())
