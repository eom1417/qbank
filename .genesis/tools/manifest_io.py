"""Writing engineering.json: one compact, stable layout (short lists stay on one line), so
the manifest stays readable and far below the 400-line limit whichever tool edits it."""
from __future__ import annotations

import json
from pathlib import Path

from layout import MANIFEST

WIDTH = 94


def dumps(value, pad: str = '') -> str:
    if isinstance(value, dict):
        if not value:
            return '{}'
        items = [f'{pad}  {json.dumps(k)}: {dumps(v, pad + "  ")}' for k, v in value.items()]
        return '{\n' + ',\n'.join(items) + f'\n{pad}}}'
    if isinstance(value, list) and any(isinstance(v, (dict, list)) for v in value):
        return '[' + ', '.join(dumps(v, pad + '  ') for v in value) + ']'
    if isinstance(value, list):
        return _scalar_list(value, pad)
    return json.dumps(value, ensure_ascii=False)


def _scalar_list(values: list, pad: str) -> str:
    one = json.dumps(values, ensure_ascii=False)
    if len(one) + len(pad) < WIDTH - 2:
        return one
    rows, row = [], ''
    for item in values:
        text = json.dumps(item, ensure_ascii=False) + ', '
        if row and len(row) + len(text) + len(pad) > WIDTH:
            rows.append(row.rstrip())
            row = ''
        row += text
    rows.append(row.rstrip().rstrip(','))
    return '[\n' + '\n'.join(f'{pad}  {r}' for r in rows) + f'\n{pad}]'


def write_manifest(root: Path, data: dict) -> None:
    (root / MANIFEST).write_text(dumps(data) + '\n', encoding='utf-8')
