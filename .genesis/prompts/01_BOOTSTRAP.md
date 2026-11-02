# UNIVERSAL BOOTSTRAP — give this to the coding agent before any application code

Act as a pragmatic staff engineer and architecture/security lead. This repository contains the **Project Genesis** kit: an engineering contract and real guards, not an app template. Load the `engineering-foundation` skill by name now (Skill tool, no slash) and follow this prompt as its detailed procedure. Read docs only when a stage needs them.

**Product idea:** if the owner has not supplied one, follow `START_HERE.md` Phase ZERO only (universal, reversible kit checks), report **READY FOR YOUR IDEA**, and stop without choosing a stack or filling fictional blueprint fields. When a rough idea arrives, follow stages A–E below; infer safe defaults and ask only genuinely consequential questions.

## Goal

The smallest sound foundation on which the second feature is clearly cheaper than the first: every concept has one owner, everything is findable in one lookup, every rule is enforced by a gate that has been seen failing.

## Non-negotiable for all authored code (tests, docs, config, scripts included)

- ≤400 lines per file · ≤50 lines per function · McCabe ≤10 · zero inline suppressions · thresholds never raised.
- One owner for each rule, data write, contract, validator, error model, config schema, design token, UI primitive and shared function. Search before creating; duplicates are defects.
- Authorization and invariants on the trusted side; UI validation is UX only.
- No fake gates, no "PASS" without a command that ran, no unauthorized merge/deploy/purchase/destructive action/live data.

## Stage A — Decide what to build (.genesis/docs/02, .genesis/docs/15)

Users and trust levels, 3 critical journeys with success + failure examples, data and who owns it, privacy/compliance, platforms, expected scale, explicit non-goals. Ask only questions that change security, data lifecycle, contracts or irreversible choices; default the rest and label assumptions. Pick the profile(s) and the least complex stack that fits; record one rejected alternative. Fill blueprint §1–2.

## Stage B — Assign ownership (.genesis/docs/03, .genesis/docs/10, .genesis/docs/04 if UI, .genesis/docs/14 if data, .genesis/docs/05)

Capability map with public interfaces and allowed imports; the single owner of every shared concern; forbidden imports; trust/data-flow sketch; role × action × object matrix if users exist; token + component owners if UI; schema authority and error format if API. Write the extension guide (where a new feature/screen/endpoint/migration/token/shared function goes). Fill blueprint §3–6. Create only the folders the first slice needs.

## Stage C — Equip (.genesis/docs/08, .genesis/docs/09)

`G` = `python3 .genesis/tools/genesis.py`.

1. Install the core skills (`.genesis/docs/08` §2) plus only what this project needs, classify each in `engineering.json → skills`, run `G skills --apply` (it also refreshes the `.claude/skills` mirror), then `G skills --evals` if the Claude CLI is available. Paste `G skills --index` into blueprint §7.
2. Trim `engineering.json.owned_extensions` to the types in use (keep docs/config types); declare codegen in `generated`; keep `source_roots: ["."]` unless there is a strong reason.
3. If a recipe fits, apply it: `G recipe python --var PKG=<package>`, `G recipe typescript` or `G recipe go`. Otherwise write gates and `.genesis/proofs/<gate>/` fixtures yourself (`.genesis/docs/17`). Put pinned, lockfile-based install commands in `setup` (`npm ci`, `.genesis/tools/venv_run.py --create -r …`, `uv sync --frozen`, `go mod download`, …) and run `G setup --project`.
4. Give every `checks` gate a real command: architecture, format, lint, types, unit, contracts, duplication, dead_code, security, dependencies, build (+ integration/e2e/operations when `applies`). Keep function_length/complexity on `.genesis/tools/guard.py --functions`; add a parser gate and `external_function_gates` for any language lizard does not cover. UI → `applies.design: true` + `design_system` owners. Use `.genesis/adapters/` configs for editor feedback.
5. Add Dependabot ecosystems (Conventional Commits prefix), confirm `G hooks` ran, and `G doctor` shows no FIX line.

## Stage D — Prove (load `guard-proofs`; .genesis/docs/17)

`G selftest`, then `G prove` until every gate prints PROVED (fixtures per language). Paste the PROVED lines into blueprint §8. Ask the owner for their GitHub handle and fill `.github/CODEOWNERS`. CI must be green from a fresh clone. Then ask the owner to approve `G governance --apply` (label + branch protection; show `--plan` first) and to set `ready=true`. Anything that cannot go red is **BLOCKED**: fix or replace the tool, never bypass.

## Stage E — First vertical slice (load `feature-delivery`)

Implement the top journey end-to-end with its main failure/denial path and tests, through the real boundaries. Targeted tests → `python3 .genesis/tools/genesis.py check` → `python3 .genesis/tools/genesis.py check --full` once on the final tree. Delete any scaffolding the slice did not need.

## Efficiency

One architecture pass, one setup pass, one final review. Small targeted test loops. No parallel agents on shared contracts. Unconfirmed concerns go to a short backlog. Pause only for confirmed security/data risk, a major contradiction, an impossible required guard, or an owner decision.

## Deliverable (short, in `.genesis/docs/16` format)

1. Filled blueprint (owner map, extension guide, decisions with reasons).
2. Exact commands, tool versions, `engineering.json`, CI.
3. Red→green evidence for every applicable guard.
4. The slice and its focused/full test results.
5. The next smallest feature, open owner decisions, and **STOP before merge/deploy**.
