"""Read and write the two invocation switches as structured data, not text matches.

Claude: top-level `disable-model-invocation` inside the SKILL.md frontmatter (YAML bool).
Codex:  `policy.allow_implicit_invocation` in agents/openai.yaml (YAML bool).
Anything else (body text, comments, other keys, quoted strings) does not lock a skill.
"""
from __future__ import annotations

CLAUDE_KEY = 'disable-model-invocation'
CODEX_KEY = 'allow_implicit_invocation'
TRUE = ('true', 'True', 'TRUE')
FALSE = ('false', 'False', 'FALSE')


def _value(raw: str) -> str:
    """Scalar with any trailing ' # comment' removed (quotes kept: "true" is a string)."""
    text = raw.strip()
    if text.startswith('#'):
        return ''
    cut = text.find(' #')
    return (text[:cut] if cut >= 0 else text).strip()


def _frontmatter_span(lines: list[str]) -> tuple[int, int] | None:
    if not lines or lines[0].strip() != '---':
        return None
    for index in range(1, len(lines)):
        if lines[index].strip() == '---':
            return 1, index
    return None


def _top_level(line: str, key: str) -> str | None:
    if line.startswith((' ', '\t', '#')) or not line.startswith(key + ':'):
        return None
    return _value(line[len(key) + 1:])


def claude_locked(text: str) -> bool:
    lines = text.splitlines()
    span = _frontmatter_span(lines)
    if span is None:
        return False
    values = [v for v in (_top_level(line, CLAUDE_KEY) for line in lines[span[0]:span[1]])
              if v is not None]
    return bool(values) and values[-1] in TRUE


def _policy_block(lines: list[str]) -> tuple[int, int, str] | None:
    """(index of 'policy:' line, end index, inline value) for the top-level policy key."""
    for index, line in enumerate(lines):
        inline = _top_level(line, 'policy')
        if inline is None:
            continue
        end = index + 1
        while end < len(lines) and (not lines[end].strip() or lines[end][:1] in (' ', '\t')
                                    or lines[end].lstrip().startswith('#')):
            end += 1
        return index, end, inline
    return None


def codex_locked(text: str) -> bool:
    lines = text.splitlines()
    block = _policy_block(lines)
    if block is None:
        return False
    start, end, inline = block
    if inline.startswith('{'):
        values = [_value(v) for k, v in _flow_pairs(inline) if k == CODEX_KEY]
    else:
        values = [_value(line.split(':', 1)[1]) for line in _children(lines, start, end)
                  if line.strip().startswith(CODEX_KEY + ':')]
    return bool(values) and values[-1] in FALSE


def _flow_pairs(inline: str) -> list[tuple[str, str]]:
    """'{a: 1, b: 2}' -> [('a', '1'), ('b', '2')] (simple flow mappings only)."""
    parts = [part.split(':', 1) for part in inline.strip('{} ').split(',') if ':' in part]
    return [(key.strip(), value) for key, value in parts]


def _children(lines: list[str], start: int, end: int) -> list[str]:
    """Direct (first-level) child lines of the policy mapping, comments excluded."""
    depth = _child(lines, start, end)
    return [line for line in lines[start + 1:end]
            if _indent(line) == depth and not line.lstrip().startswith('#')]


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip(' \t'))


def _child(lines: list[str], start: int, end: int) -> int:
    """Indentation of the policy mapping's direct children (first real child line)."""
    children = [line for line in lines[start + 1:end]
                if line.strip() and not line.lstrip().startswith('#')]
    return _indent(children[0]) if children else -1


def set_claude(text: str, lock: bool) -> str:
    lines = text.splitlines(keepends=True)
    span = _frontmatter_span([line.rstrip('\n') for line in lines])
    if span is None:
        return text
    body = [line for line in lines[span[0]:span[1]]
            if _top_level(line.rstrip('\n'), CLAUDE_KEY) is None]
    if lock:
        body.insert(0, f'{CLAUDE_KEY}: true\n')
    return ''.join(lines[:span[0]] + body + lines[span[1]:])


def set_codex(text: str, lock: bool) -> str:
    lines = text.splitlines()
    block = _policy_block(lines)
    if block is not None:
        lines = _without_switch(lines, block)
    elif lock:
        lines = lines + ['policy:']
    if lock:
        lines.insert(lines.index('policy:') + 1, f'  {CODEX_KEY}: false')
    return '\n'.join(lines) + '\n' if lines else ''


def _without_switch(lines: list[str], block: tuple[int, int, str]) -> list[str]:
    """Rewrite the policy mapping in block style without any invocation switch."""
    start, end, inline = block
    switch = [line for line in _children(lines, start, end)
              if line.strip().startswith(CODEX_KEY + ':')]
    kept = [line for line in lines[start + 1:end] if line not in switch]
    if inline.startswith('{'):
        kept = [f'  {k}: {_value(v)}' for k, v in _flow_pairs(inline) if k != CODEX_KEY] + kept
    return lines[:start] + ['policy:'] + kept + lines[end:]
