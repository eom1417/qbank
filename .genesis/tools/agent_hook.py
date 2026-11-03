#!/usr/bin/env python3
"""Claude Code hook: stop violations at the moment an agent writes them.

Wired in .claude/settings.json. Reads the hook JSON from stdin.
  pre-edit   block inline bypass markers; block policy-file edits after bootstrap
  post-edit  run the 400/50/10 guard on the edited file and feed failures back
  pre-bash   block destructive git/shell commands and hook bypasses
Exit 2 = block (pre) or report back to the agent (post). Owner override for a
deliberate policy change: start the session with GENESIS_POLICY_CHANGE=1.
"""
from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

from guard_core import POLICY_PATHS, ManifestError, is_policy_path, read_manifest
from guard_rules import bypass_problems
from layout import DOCS_DIR, PROJECT_ROOT, TOOLS_DIR
from side_effects import release_operations

TOOLS = Path(__file__).resolve().parent
DANGEROUS = (
    (r'\bgit\s+push\b[^;&|\n]*\s(?:--force(?!-with-lease)|-f)\b', 'force push'),
    (r'\bgit\s+reset\s+--hard\b', 'hard reset discards work'),
    (r'\bgit\s+clean\s+-[a-zA-Z]*f', 'git clean deletes untracked work'),
    (r'\bgit\s+branch\s+-D\b', 'force branch deletion'),
    (r'--no-verify\b', 'skipping git hooks'),
    (r'core\.hooksPath', 'changing the hook path'),
    (r'\bgit\s+(?:checkout\s+--|restore)\s+\.(?:\s|$)', 'discarding all local changes'),
    (r'\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+(?:/|~|\.|\*)(?:\s|$)', 'recursive delete of a root'),
)


def project_root(event: dict) -> Path:
    return Path(os.environ.get('CLAUDE_PROJECT_DIR') or event.get('cwd') or PROJECT_ROOT).resolve()


def is_ready(root: Path) -> bool:
    try:
        return read_manifest(root).get('ready') is True
    except ManifestError:
        return False


def relative(root: Path, raw: str) -> str | None:
    path = Path(raw)
    path = (path if path.is_absolute() else root / path).resolve()
    return path.relative_to(root).as_posix() if path.is_relative_to(root) else None


is_protected = is_policy_path
POLICY_STEMS = tuple(sorted({p.split('*')[0] for p in POLICY_PATHS if p.split('*')[0]}))
SAFE_RUN = re.compile(r'\b(?:python3?|py)\s+(?:-m\s+unittest\s+\S+\s+-s\s+)?'
                      + re.escape(TOOLS_DIR) + r'/[\w.]+(?:\.py)?')
ARG_OPTIONS = frozenset('mFCcSu')  # git commit short options whose value follows
WRITE_HINT = re.compile(r'>|\b(?:sed\s+-\w*i|perl\s+-\w*i|tee|rm|mv|cp|truncate|chmod|ln|dd|install'
                        r'|rsync|unlink|rename|replace|write\w*|open|patch|apply|checkout|restore)\b')


def policy_locked(root: Path) -> bool:
    return is_ready(root) and os.environ.get('GENESIS_POLICY_CHANGE') != '1'


def new_text(tool_input: dict) -> str:
    parts = [tool_input.get('content'), tool_input.get('new_string'), tool_input.get('new_source')]
    parts += [edit.get('new_string') for edit in tool_input.get('edits', []) if isinstance(edit, dict)]
    return '\n'.join(part for part in parts if isinstance(part, str))


def pre_edit(event: dict, root: Path) -> list[str]:
    tool_input = event.get('tool_input') or {}
    rel = relative(root, tool_input.get('file_path') or tool_input.get('notebook_path') or '')
    if rel is None:
        return []
    if is_protected(rel) and policy_locked(root):
        return [f'{rel} is a guard/policy file. Changing it is an owner decision '
                f'({DOCS_DIR}/12_GUARD_CATALOG.md "Rule changes"). Ask the owner.']
    return bypass_problems(rel, new_text(tool_input))


def post_edit(event: dict, root: Path) -> list[str]:
    tool_input = event.get('tool_input') or {}
    raw = tool_input.get('file_path') or tool_input.get('notebook_path')
    if not raw or relative(root, raw) is None:
        return []
    done = subprocess.run([sys.executable, str(TOOLS / 'guard.py'), '--root', str(root),
                           '--files', raw], capture_output=True, text=True, check=False)
    if done.returncode == 0:
        return []
    detail = (done.stderr or done.stdout).strip().splitlines()[:20]
    return detail + ['Fix by splitting by responsibility; never raise limits or suppress.']


def pre_bash(event: dict, root: Path) -> list[str]:
    command = (event.get('tool_input') or {}).get('command') or ''
    labels = [label for pattern, label in DANGEROUS if re.search(pattern, command)]
    labels += ['commit -n skips hooks'] if commit_skips_hooks(command) else []
    problems = [f'blocked: {label}. Ask the owner to run it themselves if intended.'
                for label in labels]
    if policy_locked(root):
        hits = set(shell_policy_writes(command, root)) | set(embedded_policy_writes(command))
        problems += [f'blocked: command may modify guard/policy path {rel}; policy changes are '
                     'owner decisions (CI requires the policy-change label + CODEOWNERS review)'
                     for rel in sorted(hits)]
    return problems


def _tokens(command: str) -> list[str]:
    try:
        lexer = shlex.shlex(command, posix=True, punctuation_chars=';&|')
        lexer.whitespace_split = True
        return list(lexer)
    except ValueError:
        return command.split()


def commit_skips_hooks(command: str) -> bool:
    """`git commit -n` (or a cluster such as -an), parsed as argv: message text never counts."""
    tokens, skip_next, in_commit = _tokens(command), False, False
    for previous, token in zip([''] + tokens, tokens):
        if skip_next:
            skip_next = False
        elif token in (';', '&&', '||', '|', '&'):
            in_commit = False
        elif token == 'commit' and previous == 'git':
            in_commit = True
        elif in_commit and token.startswith('-') and not token.startswith('--'):
            hit, skip_next = _short_cluster(token[1:])
            if hit:
                return True
    return False


def _short_cluster(letters: str) -> tuple[bool, bool]:
    """(cluster contains -n, next token is this option's value)."""
    for index, letter in enumerate(letters):
        if letter == 'n':
            return True, False
        if letter in ARG_OPTIONS:
            return False, index == len(letters) - 1
    return False, False


def embedded_policy_writes(command: str) -> list[str]:
    """Best effort for scripts (python -c, node -e, heredocs) that name a policy path."""
    text = SAFE_RUN.sub(' ', command)
    if not WRITE_HINT.search(text):
        return []
    return [stem for stem in POLICY_STEMS if stem in text]


def shell_policy_writes(command: str, root: Path) -> list[str]:
    try:
        tokens = shlex.split(command)
    except ValueError:
        tokens = command.split()
    hits = []
    for token in tokens:
        rel = relative(root, token) if token and not token.startswith('-') else None
        if rel and is_protected(rel) and _writes_to(command, token):
            hits.append(rel)
    return sorted(set(hits))


def _writes_to(command: str, token: str) -> bool:
    target = re.escape(token)
    return bool(
        re.search(rf'(?:>>?|\btee\s+(?:-a\s+)?)\s*["\']?{target}', command)
        or re.search(rf'\b(?:sed\s+-[a-zA-Z]*i|perl\s+-[a-zA-Z]*i|rm|mv|truncate|chmod|ln)\b'
                     rf'[^;&|\n]*{target}', command)
        or re.search(rf'\bcp\b[^;&|\n]*\s["\']?{target}["\']?\s*(?:$|[;&|])', command))


HANDLERS = {'pre-edit': pre_edit, 'post-edit': post_edit, 'pre-bash': pre_bash}


# DEC-29 (owner, 2026-11-03): a milestone branch is merged into main locally, fast-forward
# only, on the owner's word in chat; the confirmation prompt cannot reach the owner on a
# remote host. Any other merge, and every other outward action, still asks.
_MERGE = re.compile(r'\bgit\s+merge\b(?!-)([^;&|\n]*)', re.I)


def _only_fast_forward_merges(command: str, labels: list[str]) -> bool:
    merges = _MERGE.findall(command)
    return labels == ['merging branches'] and all(
        re.fullmatch(r'\s*--ff-only\s+[\w./-]+\s*', args) for args in merges)


def ask_owner(event: dict) -> str | None:
    """Publishing/deploying/merging: Claude Code shows the owner a confirmation prompt."""
    command = (event.get('tool_input') or {}).get('command') or ''
    labels = release_operations(command)
    if _only_fast_forward_merges(command, labels):
        return None
    if not labels:
        return None
    reason = (f'Project Genesis: this command is {", ".join(labels)}. It acts outside the '
              'working tree; run it only if the owner approves this exact command.')
    return json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse',
                                              'permissionDecision': 'ask',
                                              'permissionDecisionReason': reason}})


def handle(name: str, event: dict) -> tuple[list[str], str | None]:
    """(blocking problems, optional owner question) for one hook event."""
    problems = HANDLERS[name](event, project_root(event))
    question = ask_owner(event) if name == 'pre-bash' and not problems else None
    return problems, question


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 1 or argv[0] not in HANDLERS:
        print(f'usage: agent_hook.py {{{"|".join(HANDLERS)}}}', file=sys.stderr)
        return 1
    try:
        event = json.loads(sys.stdin.read() or '{}')
    except ValueError:
        return 0
    problems, question = handle(argv[0], event if isinstance(event, dict) else {})
    for problem in problems:
        print(problem, file=sys.stderr)
    if question:
        print(question)
    return 2 if problems else 0


if __name__ == '__main__':
    raise SystemExit(main())
