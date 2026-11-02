# Guard catalog: what is enforced, where, and how it is proven

`G` = `python3 .genesis/tools/genesis.py`.

## Five independent layers (a violation must pass all five to land)

| Layer | Mechanism | Stops | Can be skipped by |
|---|---|---|---|
| 1. Instructions | `AGENTS.md`, `CLAUDE.md`, bundled skills | wrong approach before code exists | an agent ignoring text → layers 2–5 |
| 2. Agent hooks | `.claude/settings.json` → `.genesis/tools/agent_hook.py` | bypass markers before write; 400/50/10 right after each edit; destructive git denied; publish/deploy/merge/main-branch push **ask the owner**; kit/policy writes after bootstrap (best effort: text matching cannot see every script) | non-Claude agents, manual edits, obfuscated scripts → layers 3–5 |
| 3. Git hooks | `.githooks/pre-commit` (fast gate), `commit-msg` (Conventional Commits), `pre-push` (full gate) | bad commits and pushes on any machine or agent | `--no-verify` / `commit -n` (denied in layer 2) → layers 4–5 |
| 4. CI | `.github/workflows/quality.yml`: self-tests, policy-change label gate, **base-branch guard**, `G prove` | everything from a clean checkout, including gates that stopped detecting anything and PRs that loosen the guard itself | nothing, if layer 5 is on |
| 5. Branch protection + CODEOWNERS | `G governance --apply`: required check *Engineering quality*, no force push or deletion, Code Owner review when the repo has 2+ collaborators | merging red or self-approved policy changes | repository admins |

Layers 1–4 ship with the kit. Layer 5 lives in the hosting platform: the owner approves `G governance --apply`, and `G governance --verify` reads it back. Record the result in `BLUEPRINT.md` §8. A solo owner cannot approve their own PR on GitHub, so the solo profile relies on the required check plus the label gate.

## Requirements and proofs

| Risk / policy | Gate | Required failure proof |
|---|---|---|
| Authored file > 400 lines | built-in `guard.py` (all tracked authored files) | 401-line file rejected |
| Inline suppression / raised threshold | `guard.py` bypass scan + pre-edit hook | planted `noqa`/`eslint-disable`/`nolint` rejected |
| Function > 50 lines / complexity > 10 | `guard.py --functions` (+ extra parser gates) | 51-line and CCN-11 functions rejected **per language** |
| Language without a measuring gate | `--functions` coverage check | file of that type rejected until a gate is declared |
| Copy-paste (one owner per logic) | built-in `duplication.py` (+ jscpd / pylint / dupl) | two copies of a block rejected; one owner called twice passes |
| Raw design values / forked controls | built-in `design_guard.py` (+ Stylelint/ESLint) | raw hex, px, font, z-index, arbitrary Tailwind value and native `<button>` in a feature rejected |
| File outside roots / hidden as generated | discovery + generated validation | stray file and over-broad pattern rejected |
| Layer inversion / cycles | stack import-graph tool | wrong-direction import and a cycle rejected |
| Format / types / lint | formatter check, type checker, linter | misformatted, mistyped, lint-violating files fail |
| Dead code | Knip / vulture / unused with real entry points | planted unused symbol reported |
| Contracts | schema compatibility + consumer tests | breaking change fails |
| Vulnerable dependencies | pip-audit / npm audit / govulncheck | pinned version with a known advisory fails |
| Secrets / unsafe calls | secretlint / Gitleaks / bandit / gosec / Semgrep | planted credential or `shell=True` flagged |
| Data integrity | migration lint + transactional tests | duplicate or conflicting write rejected |
| Authorization / tenant isolation | real-boundary integration tests | cross-user access refused |
| Skill invocation policy | built-in `skills_policy.py --check`: scans every file of every skill, mirror identical | unclassified, out-of-sync, binary or side-effect skill left callable is rejected |
| Agent rule files | `AGENTS.md`, `CLAUDE.md`, `START_HERE.md`, `.genesis/`, skills are policy paths | editing them needs the `policy-change` label + Code Owner review; Claude hook blocks them after `ready` |
| Project space stays free | `docs/`, `tools/`, `prompts/`, `scripts/`, `BLUEPRINT.md` are never policy | the agent may edit them after `ready` |
| Gate actually detects its violation | `G prove` + ledger `.genesis/proofs.json` | `git status` as a lint gate is reported UNPROVEN |
| Proof is about the gate's own kind | `proof_semantics.py`: reserved commands, signatures, control runs | the size guard cannot prove `security`; a security fixture that still fails without its secret is UNPROVEN |
| Policy change needs the owner | `policy_gate.py` in CI + CODEOWNERS (GitHub matching rules, last match wins) | PR editing `.genesis/` without the label fails; `/.genesis-evil/` or a later owner-less rule fails |
| Fake "generated" exclusions | `verify` regeneration | hand-written file under a generated pattern fails |
| Obvious fake gates | command validation (pre-filter; proofs are the real test) | `echo`, `true`, `python -c`, placeholders rejected |
| Commit history | `commit-msg` hook | "Update stuff" rejected; `feat(x): y` accepted |
| Change scope | diff review (`boundary-review`) + PR template | unrelated file flagged |

## Status vocabulary (use exactly these words)

- **Guarded**: a named command ran in CI and a deliberately broken fixture made it fail.
- **Reviewed**: a judgment with a recorded owner and acceptance case. It is not automated and is never called automated.
- **Not applicable**: the boundary genuinely does not exist (no UI, no DB, no users); the reason is recorded.
- **Blocked**: a required gate cannot run. `ready` stays false and nothing merges around it.

## Gate sizing

- **Fast** (seconds, every edit): built-ins, function gates, import boundaries, format, lint, types, design.
- **Full** (every PR): fast + tests, contracts, duplication, dead code, security, dependencies, build, and integration/E2E when applicable.
- **Release**: full + operations checks, migration rehearsal, environment verification.

## Rule changes (owner decision, never part of a feature)

No task edits thresholds, exclusions, tool configs, fixtures or workflows to get its own change through. A policy change is its own PR with the reason, the coverage diff, red→green proof and owner approval (CODEOWNERS + `policy-change` label). The 400/50/10 limits, the copy-paste threshold and the bypass ban are not negotiable at all. In Claude Code, an owner deliberately changing policy starts the session with `GENESIS_POLICY_CHANGE=1`.
