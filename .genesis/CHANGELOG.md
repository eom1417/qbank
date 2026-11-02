# Changelog

## v7 (2026-11-02): the kit owns one folder, enforces your two missing rules, installs anywhere

Every item below was found by running the v6.2 kit, and each one is now covered by a test.

**Fit for any project**
- All kit files moved into `.genesis/` (tools, docs, prompts, recipes, proofs, adapters, templates). v6.2 locked the root folders `docs/`, `tools/`, `prompts/` and `adapters/` as policy, so after `ready` the agent could not edit `docs/api-guide.md`, an AI product's `prompts/system_prompt.md` or a `tools/seed_db.py`. These folders are the project's again.
- One entry (`START_HERE.md`; `00_START_HERE.md` removed), the blueprint at the root (`BLUEPRINT.md`), docs renumbered 01–18 without gaps.
- `genesis.py`: one command for everything (`doctor`, `setup`, `check`, `prove`, `skills`, `recipe`, `hooks`, `governance`, `install`, `selftest`).
- `install --into DIR` copies the kit into any project and never overwrites (`<file>.genesis-new` to merge).
- `doctor`: a read-only health report that ends with the next step.

**Rules that were only documented, now enforced in every language**
- `duplication.py` (built in, before every gate): no block of 8+ significant lines may repeat. It found a real clone in the kit's own new code, which was then moved to one owner (`cli.py`).
- `design_guard.py` (built in when `applies.design`): raw colors, sizes, durations, fonts, z-index, Tailwind arbitrary values and native controls are allowed only in the declared token and component owners. Web, Flutter and SwiftUI patterns are covered.
- New `dependencies` gate (vulnerable packages) in all recipes: pip-audit, npm audit, govulncheck.
- Conventional Commits enforced by `.githooks/commit-msg`.

**Works on real machines**
- Kit tools are hash-pinned and installed into `.genesis/.pylib` (`pip --target`, with a hash-verified stdlib download as fallback). v6.2's `pip install` failed on Ubuntu 24.04 (PEP 668), which left the 50/10 guard BLOCKED.
- Python recipe: `.venv` through `venv_run.py` on Linux, macOS and Windows; it fills a pip-less venv when `python3-venv` is missing.
- One skill source (`.agents/skills`), with an exact mirror or symlink in `.claude/skills`. v6.2 shipped two hand-kept copies and failed its own guard where `.claude/skills` is a symlink.

**Safer agent behaviour**
- The pre-bash hook now **asks the owner** (Claude Code `permissionDecision: ask`) before publish, deploy, merge, a push to main, infrastructure or database changes, and governance changes. One central list (`side_effects.py`) feeds the hook and the skill scanner.
- `git commit -m "handle -nan"` is no longer blocked: `commit -n` is parsed as argv.
- `git merge-base` (read-only) no longer marks a skill as dangerous. All upstream skills from Matt Pocock, Superpowers and Anthropic are classified.
- `governance --plan|--apply|--verify`: label and branch protection through `gh`, with a solo profile (GitHub forbids self-approval) and a team profile.

**Recipes re-proven end-to-end on fresh projects in this environment** (Python 3.12, Node 22, Go 1.27):
- Python: 14/14 commands PROVED.
- TypeScript: 16/16. Fixes: `types: ["node"]` and `@types/node` for TypeScript 6.
- Go: 14/14. In v6.2, contracts, duplication, dead_code and security were unverified, and `types` and `build` shared one command, which the kit's own rules reject. `arch_test.go` now passes gosec without any suppression.

**Cleanups**
- Test files named after review rounds (`test_review_v4.py` …) were renamed by behavior.
- Hard-coded test counts were removed from docs.
- Templates added: `ADR.md`, `SECURITY.md`. `.gitattributes` (LF everywhere) added.

## History before v7 (summary)

- **v6.x:** structured skill-lock parsing (body text and comments never lock); per-client lock checks; every policy category owned in CODEOWNERS; agent rule files governed like guards; every file of a skill scanned.
- **v5:** proof specificity (reserved size guard, signatures, control runs); generated files must regenerate byte-for-byte; GitHub CODEOWNERS semantics; required skills; git-ignored fixtures rejected.
- **v4:** executable proofs and ledger; fail-closed when a tool is missing; full inline-suppression ban; every file classified; skill policy with safe and risky lists; pinned installers; real-agent skill evals.
- **v3:** `CLAUDE.md` imports `AGENTS.md`; discovery through git; lizard for 25+ languages; Claude, git and CI hooks; bundled skills.
