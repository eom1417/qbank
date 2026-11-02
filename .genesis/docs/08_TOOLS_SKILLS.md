# Skills and tools: install few, call by name, keep risky ones explicit

**Skills teach procedures; tools enforce facts.** Loading a skill is never evidence that work is correct; the gates are. `G` = `python3 .genesis/tools/genesis.py`.

## 1. How "call by name, no slash" works (and its safety limit)

- **One source, one mirror.** Skills are authored in `.agents/skills/<name>/SKILL.md` (read by Codex and most agents). `.claude/skills/` is an exact mirror for Claude Code: a copy refreshed by `G skills --sync` / `--apply`, or a symlink to `../.agents/skills`. Never edit the mirror; a differing mirror copy is replaced by the source (the note says so, git keeps the old copy).
- A skill is **model-invocable**, meaning it is loaded when its name appears anywhere in a message or when the request matches its description, unless it carries `disable-model-invocation: true` (Claude, SKILL.md frontmatter) or `policy.allow_implicit_invocation: false` in `agents/openai.yaml` (Codex). `AGENTS.md` tells every agent to load a named skill with its native Skill tool.
- `engineering.json → skills` is the policy:
  - `required`: must be installed for every agent; missing means FAIL. Default: the six bundled skills.
  - `model_invocable`: safe, callable by name.
  - `user_only`: side effects (publishing, merging, deploying, deleting, account changes); slash only.

  `--check` reports what is actually installed, never the size of the allow-list.

```bash
G skills --apply     # sync mirror, unlock the safe list, lock the risky list (Claude + Codex)
G skills --check     # run by every gate: unclassified, wrong state, mirror drift, or a "safe"
                     # skill whose files (any language) publish/deploy/merge/push/rm -rf fails
G skills --index     # name / how to call / purpose table for BLUEPRINT.md §7
G skills --evals     # asks the real Claude Code CLI which skill it loads (routing proof)
G skills --install-user   # adds `genesis-start` to ~/.claude/skills and ~/.agents/skills
```

Re-run `--apply` after every install or update. `--evals` is the only proof that routing works; `--check` proves configuration, not model behavior.

**Any folder, by name:** after `G skills --install-user`, saying "ابدأ مشروع جديد" or "start a new project" in **any** folder loads `genesis-start`, which installs this kit there with `install --into` (never overwriting) and continues at `START_HERE.md`. The project's own skills then take over.

**Measured routing (Claude Code headless, 2026-11-02, `G skills --evals`):** 15/15. That is 8/8 loaded by name in Arabic and English, including a name in the middle of a sentence; 7/7 implicit requests routed to the right skill; and the explicit-only `to-spec` stayed unloaded when named. Codex routing has not been measured yet: run `G skills --evals` (cases in `.genesis/tools/skill_evals.json`) in your own client before relying on it.

## 2. Recommended skills: a small core, extras only on need

Pinned installer (`skills@1.7.4`), copies for both agent homes, sources recorded in `skills-lock.json`:

```bash
# Core: engineering discipline used by every project
npx -y skills@1.7.4 add mattpocock/skills -a claude-code -a codex --copy -y \
  -s tdd -s diagnosing-bugs -s codebase-design -s domain-modeling -s grilling -s handoff
npx -y skills@1.7.4 add obra/superpowers -a claude-code -a codex --copy -y \
  -s verification-before-completion
G skills --apply && G skills --check
```

Add only when the project needs it: `writing-plans` (file-based plans), `frontend-design` + `webapp-testing` (UI; `anthropics/skills`), `research`, `prototype`, `grill-with-docs`, `systematic-debugging` (instead of `diagnosing-bugs`, not both), `to-spec`/`to-tickets` (issue tracker; explicit-only). Every installed skill must be in one of the two policy lists or `--check` fails. The template already classifies every skill of the three upstream repositories (checked in `.genesis/docs/18`).

`code-review` (Matt Pocock) is not in the core: `boundary-review` covers reviews, and several clients ship a built-in command with the same name, which makes routing by name ambiguous.

Commit `.agents/skills/`, `.claude/skills/` and `skills-lock.json`; `npx skills@1.7.4 experimental_install` reproduces them. Skills listed in the lock with a `source` are treated as vendored (excluded from 400/50/10); the six bundled Genesis skills never are.

Do not install `using-superpowers` or `brainstorming` (they force a skill check before every reply, a constant token cost) or a managed plugin bundle next to copies (every skill twice; managed bundles cannot be re-policed).

## 3. Review third-party skills like code

They run with the agent's permissions. `--check` scans every file of a skill (any script language, argv-style calls too; binaries force explicit-only), but a regex is a classifier, not a sandbox: read every new `SKILL.md` and script before committing, and put anything that publishes, merges, deploys, deletes or touches accounts in `user_only`. Skill folders are owned in CODEOWNERS, so skill changes need owner review. `AGENTS.md` wins over any skill text. Platform-provided skills that appear in `.agents/skills` (some hosted workspaces add their own) are classified like any other.

## 4. Deterministic tools (proven recipes first)

`.genesis/recipes/` holds configurations **proven red→green end-to-end** on sample projects (`G prove` printed PROVED for every command):

| Recipe | Gate commands proven | Apply |
|---|---|---|
| `python` | 14: import-linter, ruff format/check, mypy --strict, pytest unit/contracts, copy-paste guard + pylint duplicate-code, vulture, bandit, pip-audit, compileall, guard | `G recipe python --var PKG=<package>` |
| `typescript` | 16: dependency-cruiser, guard + ESLint (size, complexity), prettier, ESLint strict, tsc, vitest unit/contracts, copy-paste guard + jscpd, knip, secretlint, npm audit, build | `G recipe typescript` |
| `go` | 14: stdlib arch/gofmt tests, guard, vet, compile incl. tests, go test, contract tests, copy-paste guard + dupl, unused, gosec, govulncheck, build | `G recipe go` |

The applier never overwrites a project file (writes `*.recipe-new`) or a configured gate. Python tools run from the project `.venv` through `.genesis/tools/venv_run.py` (Linux, macOS, Windows; PEP 668 safe). Other stacks: pick tools from the table and write fixtures the same way (`.genesis/docs/17`).

| Need | Typical tools | Fixture idea |
|---|---|---|
| Layers / cycles | dependency-cruiser, import-linter, ArchUnit, depguard, stdlib import test | domain file importing an adapter |
| Duplication | built-in `duplication.py` + jscpd, pylint duplicate-code, dupl | two copies of one function |
| Dead code | Knip, vulture, unused/staticcheck | a function nobody calls |
| Secrets / SAST | secretlint, Gitleaks (`dir`), Semgrep, bandit, gosec | fake token, `shell=True` call |
| Vulnerable dependencies | pip-audit, npm audit, govulncheck, OSV-Scanner, cargo audit | a pinned version with a known advisory |
| Format / types / build | Prettier, ruff format, gofmt test; tsc, mypy, compiler | misformatted file, wrong type, syntax error |
| Design tokens / a11y | built-in `design_guard.py`, Stylelint strict-value, axe | raw `#hex` in a feature, unlabeled input |

## 5. MCP servers

Add one only for a concrete need, with least privilege and never production write credentials. List it in `BLUEPRINT.md` §7 with its owner.
