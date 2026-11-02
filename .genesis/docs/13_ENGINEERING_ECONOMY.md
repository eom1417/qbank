# Engineering economy — fewer tokens, fewer files read, fewer retries

Optimize the **total cost of a correct change**: context + tool runs + retries + later bug repair. Not the fewest lines, not the most files.

## Progressive disclosure (what an agent loads)

1. Always: `AGENTS.md` (< 150 lines) via `CLAUDE.md`/native loading. Nothing else by default.
2. Per task: the blueprint owner row + the one or two topic docs the task touches.
3. Skills: descriptions are always visible; a full `SKILL.md` loads only when used.
4. Code: symbol/file search first → the smallest direct call graph → only the functions involved. Never dump whole directories or large files.
5. Tool output: read the FAIL lines, not full logs. Gates print concise findings for this reason.
6. After a coherent step: a 1–3 line decision note; no re-explaining.

## Navigation contract

- One owner map (`capability → path → public interface → tests`) in the blueprint. If you cannot find an owner in one lookup, the map is incomplete — fix the map.
- Explicit, named public entry points; no deep forwarding chains, untyped registries, barrel re-exports or proxy wrappers.
- Implementation, helpers, tests and invariants of a capability are co-located; only proven-shared concepts move to `platform/` owners.
- One authoritative "how to add a feature / endpoint / screen / migration / test / command" section in the blueprint; link to it, never copy it.

## Never spend tokens on what a gate decides

Sizes, complexity, import graph, formatting, types, test pass/fail → tools. Product ambiguity, trade-offs, security policy, interpretation of scanner warnings → AI + evidence.

## Anti-bureaucracy

- One short plan for multi-file or risky changes; none for single-file work.
- One implementation owner, one comprehensive review, one full gate on the final tree. Targeted tests may repeat.
- Non-blocking findings go to a backlog; only confirmed data loss, security bypass, broken contract or major regression interrupts.
- Parallel agents only for disjoint file ownership in separate worktrees with one integrator; never for shared contracts, schemas or the design system.
- Reuse existing libraries/tools/controls when simplest; avoid overlapping dependencies and speculative services.
- Do not install skills that run on every message (`.genesis/docs/08`).

## Measuring an improvement (before claiming one)

For a small, a medium and a boundary-spanning change, record before/after with the same task text, model and environment: input/output tokens, files read, time to first correct implementation, reruns, modules touched, gates status. Report proxies as proxies; never invent percentages.

## Refactoring decision test

Change a boundary only when it improves ownership, reduces navigation or coupling, removes a proven duplicate, or fixes a real defect. State one expected improvement and one test proving behavior is unchanged. Reject refactors that add file hops or latency without that value.

Handoff format: `.genesis/docs/16_ACCEPTANCE_AND_HANDOFF.md` (single owner).
