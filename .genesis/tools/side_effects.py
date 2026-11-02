"""Commands with effects outside the working tree. One list, used by the skill scanner
(a model-invocable skill may not contain them) and the Claude pre-bash hook (it asks the
human before any of them runs).
"""
from __future__ import annotations

import re

# Publishing, deploying, merging, destroying: the owner must approve each run.
RELEASE = (
    (r'\bgh\s+pr\s+merge\b', 'merging a pull request'),
    (r'\bgh\s+(?:release\s+create|repo\s+(?:delete|archive|edit))\b', 'changing the GitHub repository'),
    (r'\bgit\s+push\b[^;&|\n]*\s(?:origin\s+)?(?:HEAD:)?(?:main|master)\b', 'pushing to the main branch'),
    (r'\bgit\s+merge\b(?!-)', 'merging branches'),  # git merge-base is read-only
    (r'\b(?:npm|pnpm|yarn|bun)\s+publish\b|\bcargo\s+publish\b|\btwine\s+upload\b', 'publishing a package'),
    (r'\bdocker\s+push\b', 'pushing an image'),
    (r'\bterraform\s+(?:apply|destroy)\b|\bpulumi\s+(?:up|destroy)\b', 'changing infrastructure'),
    (r'\bkubectl\s+(?:apply|delete|rollout)\b|\bhelm\s+(?:install|upgrade|uninstall)\b', 'changing a cluster'),
    (r'\b(?:vercel|netlify|fly|firebase|wrangler|railway|heroku)\s+(?:deploy|publish|up)\b'
     r'|\bvercel\s+--prod\b', 'deploying'),
    (r'\bsupabase\s+db\s+(?:push|reset)\b|\bprisma\s+migrate\s+(?:deploy|reset)\b', 'changing a database'),
    (r'\bDROP\s+(?:TABLE|DATABASE|SCHEMA)\b|\bTRUNCATE\s+TABLE\b', 'destroying data'),
    (r'\bgenesis\.py\s+governance\s+--apply\b|\bgithub_setup\.py\s+--apply\b',
     'changing repository governance'),
)
_ARGV = (r'["\']git["\']\s*,\s*["\'](?:push|merge|reset|clean)'
         r'|["\'](?:npm|gh|terraform|kubectl|docker|vercel)["\']\s*,\s*'
         r'["\'](?:publish|release|apply|delete|push|deploy)')
_LOCAL = r'\bgit\s+(?:push\b(?!-)|branch\s+-D|reset\s+--hard|clean\s+-f)|\brm\s+-rf\b'
# A skill that may start on its own must contain none of these (any language, argv style too).
SKILL_SENSITIVE = re.compile('|'.join([p for p, _ in RELEASE] + [_ARGV, _LOCAL]), re.I)


def release_operations(command: str) -> list[str]:
    return [label for pattern, label in RELEASE if re.search(pattern, command, re.I)]
