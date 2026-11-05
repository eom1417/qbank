@AGENTS.md

## Claude Code specifics

- The import line above loads `AGENTS.md`, the single contract. Do not duplicate rules here.
- Project skills: the one source is `.agents/skills/` (Codex and other agents read it); `.claude/skills/` is its exact mirror for Claude Code (a copy, or a symlink to `../.agents/skills`). Edit only `.agents/skills/`, then run `python3 .genesis/tools/genesis.py skills --apply`. The skills check fails on drift, unclassified skills, or risky skills left callable.
- When the user names a skill anywhere in a message (no slash), call the Skill tool with that name **first, before any other tool**, unless it is listed in `skills.user_only`.
- `.claude/settings.json` hooks run `.genesis/tools/agent_hook.py`:
  - before an edit, bypass markers are blocked, and so are kit/policy files once `engineering.json.ready` is true;
  - after an edit, the file is re-checked for 400/50/10;
  - before a shell command, destructive git (force push, hard reset, clean, `--no-verify`, `commit -n`) is denied, publishing, deploying and any push that rewrites or deletes remote history trigger a confirmation prompt for the owner, while merging and plain pushes to the main branch run on the owner's word in chat (DEC-37).
- A hook message is a real failure: fix the code, never work around the hook. Hooks are the fast feedback layer. The security boundary is CI (base-branch guard, `policy-change` label) together with CODEOWNERS and branch protection.
- Personal, uncommitted settings belong in `.claude/settings.local.json` (git-ignored).
