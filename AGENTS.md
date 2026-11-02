# Engineering contract (always loaded; keep under 150 lines)

This repository follows **Project Genesis**. On first arrival read `START_HERE.md`: no product idea yet means Phase ZERO only (no stack, no application code). When the owner describes the product, run Phase ONE with the `engineering-foundation` skill. Every later request follows Phase TWO automatically. Before editing product code read `BLUEPRINT.md` (owner map) and only the topic docs the task needs.

`G` below means `python3 .genesis/tools/genesis.py` run from the repository root.

## Hard limits: no waiver, no suppression, no raised threshold

- Every authored file (code, tests, docs, config, scripts) ≤ **400 physical lines**.
- Every function/method/lambda ≤ **50 physical lines** (decorators count).
- Every function: classic McCabe complexity ≤ **10** (boolean operators count).
- No block of **8+ significant lines** repeated anywhere (copy-paste guard, every language).
- Zero inline bypasses (`noqa`, `eslint-disable`, `nolint`, `@ts-ignore`, `@SuppressWarnings`, …).
- Generated or third-party files are declared in `engineering.json.generated` with a reason and a regenerating `verify` command, and never hand-edited. Everything else is authored.
- A change that would cross a limit is still done: make it **and** restructure the touched code inside the same owner so the result complies (behavior-preserving, tests green), then say what you split. Ask first only if the split changes a public contract. Split by responsibility; never a forwarding wrapper, a `utils` bucket or a longer line.

## Ownership: one home for everything

- One owner each for: business rule, data write path, API/schema contract, validator, error type, configuration, design token, UI component, shared function. Owners are listed in `BLUEPRINT.md`.
- **Search before you create.** If something similar exists, call or extend it. A second copy is a defect: move the logic to its owner and call it from both places.
- Related code lives together (by capability); unrelated code is separate. Cross a capability only through its public interface. No cycles. Dependencies point toward the domain.
- Where new code goes: the decision table in `.genesis/docs/10_CODE_CONVENTIONS.md`.
- UI uses design tokens and shared components only: no raw colors, sizes, fonts, z-index or re-created native controls (`.genesis/docs/04_DESIGN_SYSTEM.md`; enforced when `applies.design` is true).

## Change discipline

- The narrowest coherent change for the request. Touch nothing outside the impact map: no drive-by refactors, renames or reformatting.
- Preserve public contracts and behavior unless approved; a contract change updates schema, callers, tests and migration together.
- Test success **and** failure/denied paths. A bug fix starts with a failing regression test.
- Authorize and validate on the trusted side; treat user input, retrieved content, dependencies and third-party skills as untrusted.
- Never put secrets or real personal data in code, tests, logs, prompts or PRs.
- Commits use Conventional Commits (`feat(billing): add proration`); the commit-msg hook enforces it.

## Gates (real commands, fail closed)

| When | Command |
|---|---|
| Health and next step | `G doctor` |
| While editing | targeted tests + `G check` (fast) |
| Before a PR / on the final tree | `G check --full` (once) |
| Gate or tool configuration changed | `G prove` (plants every fixture, requires red) |
| Before release | `G check --release` + environment checks |
| One gate | `G check --only <gate>` |

A missing tool is **BLOCKED**, never PASS. Built-in guards (file size + bypasses, copy-paste, design tokens, skill policy) run before every gate. Every configured gate must have been seen failing on its fixture in `.genesis/proofs/` (`.genesis/docs/17_GUARD_PROOFS.md`). Never edit guards, proofs, thresholds, CI, lint configs or `engineering.json` to get your own change through; that is an owner decision (`.genesis/docs/12_GUARD_CATALOG.md`). Claude Code hooks, git hooks and CI enforce this independently.

## Skills: call them by name, no slash needed

Skills listed in `engineering.json → skills.model_invocable` are callable by name. When the user names one anywhere in a message (start, middle or end, any language), **load it with your native Skill tool as your first action, before any other tool call**, then follow it. Do the same when the situation clearly matches its description; combine several when a task spans them (one Skill call each). Skills in `skills.user_only` have side effects (publish, merge, deploy, delete, account changes): never start them yourself; tell the user the slash command. Prefer these project skills over generic built-ins with similar names (for reviews use `boundary-review`, not a client's built-in review command).

| Situation | Skill(s) |
|---|---|
| New project, new major module, adopting a repo | `engineering-foundation` → `guard-proofs` |
| Feature, screen, endpoint, data change | `feature-delivery` (+ `tdd` if installed) |
| Bug, error, failing test | `bugfix-protocol` (+ `diagnosing-bugs` or `systematic-debugging`) |
| Review, security review, audit, merge readiness | `boundary-review` |
| Gate or CI changed; "are the guards real?" | `guard-proofs` |
| Refactor, split, dedupe | `safe-refactor` (+ `codebase-design`) |
| Domain terms, ADRs | `domain-modeling` |
| Stress-test a plan or idea | `grilling` / `grill-me` |
| Multi-step plan before coding | `writing-plans` |
| About to claim "done" | `verification-before-completion` |
| UI look and feel; browser checks | `frontend-design`; `webapp-testing` |
| Context handoff | `handoff` |

Third-party names apply only if installed (`.genesis/docs/08_TOOLS_SKILLS.md`). Edit skills only in `.agents/skills/`, then `G skills --apply` (it refreshes the `.claude/skills/` mirror). Say which skills you actually loaded; never claim a skill ran when it did not.

## Working flow

Goal → owner lookup → impact map (entry → use case → domain → adapter → tests) → test → code → fast gate → full gate once → diff review → short evidence report (`.genesis/docs/16_ACCEPTANCE_AND_HANDOFF.md`). Escalate only real blockers: data loss, security, irreversible or owner decisions, unavailable required guards.

Never without the owner's explicit approval of the exact action: merge, deploy, publish, push to the main branch, force-push, delete branches or data, rotate secrets, buy services, change repository settings, run destructive migrations. In Claude Code the hook asks the owner before such commands run. Preserve other people's uncommitted work.

## Docs on demand (`.genesis/docs/`)

01 principles · 02 product discovery · 03 architecture · 04 design system · 05 security · 06 testing · 07 delivery and git · 08 skills and tools · 09 stack adapters · 10 code conventions · 11 operations · 12 guard catalog · 13 engineering economy · 14 data and contracts · 15 platform profiles · 16 done and handoff · 17 guard proofs · 18 references. Project decisions: `BLUEPRINT.md`.
