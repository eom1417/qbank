# Guard proofs: a gate counts only after it was seen failing

`G` = `python3 .genesis/tools/genesis.py`.

## How it works (automated, not a checklist)

1. **Fixtures.** Every configured gate has a fixture folder: `.genesis/proofs/<gate>/`, or `.genesis/proofs/<gate>/<n>/` for the n-th command of a multi-command gate. Files end in `.probe`, and the path below the folder is where the fixture is planted (`.genesis/proofs/lint/src/probe_lint.py.probe` → `src/probe_lint.py`).
2. **Planting.** `G prove` first runs every gate on the clean tree, where each must pass. Then, gate by gate, it plants the fixture, runs the gate, and **requires a non-zero exit whose output mentions the planted file**. The text in `expect.txt` replaces the file name when the failure names something else, such as a test or a package. Planted files are always removed and replaced files restored byte-for-byte; an interrupted run is recovered on the next check.
3. **Per language.** Function gates need a fixture **per code language** present in the repository (`.py`, `.ts`, `.go`, `.sh`, …). The kit ships fixtures for its own languages in `.genesis/proofs/*/probe_kit/`.
4. **Ledger.** Success writes `.genesis/proofs.json`, a hash of each command, fixture and expectation. Every later `G check` refuses a gate whose command or fixture changed since it was proven. CI always re-proves, so a hand-edited ledger buys nothing.

**Specificity (a proof must be about the gate's own kind of violation):**

- The size guard (`guard.py`) can only prove `function_length`/`complexity`, and one command cannot certify two unrelated gates.
- `security`, `architecture` and `duplication` fixtures must contain a recognisable violation of that kind: a secret or dangerous call, an import, or two copies of the same code (`.genesis/tools/proof_semantics.py`). The prover then runs a **control**: the same fixture with only that violation neutralised (or one copy removed) must turn the gate green. A gate that stays red failed for something else and is UNPROVEN.
- No fixture of a non-size gate may contain a 50/10 violation, so a long function cannot "prove" lint, types or security.

**What this rejects automatically:**
- `git status`, `ls` and `true`-like gates;
- gates pointed at the wrong folder, gates that fail for unrelated reasons, and tools that silently skip a language;
- missing fixtures.

It also caught real defects while the recipes were built: a duplication threshold that missed short-line clones, and a dupl threshold too loose to see a 20-line copy.

**What it cannot judge semantically:**
- format, lint, types, unit, contracts and dead_code, beyond "red, mentions the fixture, no size violation";
- a deliberately crafted command that detects the fixture by name. That is a policy edit, which requires the `policy-change` label and CODEOWNERS approval in CI.

## What each fixture should contain

| Gate | Fixture |
|---|---|
| architecture | a domain/inner file importing an adapter/outer file (plant both if needed) |
| function_length / complexity | a 51+-line function / an 11-branch function, one per language |
| format / lint / types | misformatted file / vet or lint error / wrong type |
| unit | a failing test |
| contracts | a replaced implementation that changes a public response, plus `expect.txt` naming the contract test |
| duplication | two files sharing a 10+-line function body |
| dead_code | a function or export nothing uses |
| security | a fake credential or an unsafe call (`shell=True`) |
| dependencies | a manifest/lockfile pinning a version with a known advisory (+ calling code for symbol-level scanners), `expect.txt` naming the package |
| build | a syntax error |
| design (extra command) | raw `#hex`/`px` in a feature file, a forked primitive |
| integration (users/data) | a request that reads another tenant's record |

Fixtures may not target `.genesis/`, `.github/`, `.claude/`, `.agents/`, `.githooks/`, `.git/` or `engineering.json`.

## Built-in guards and the kit itself

The built-ins (`guard.py`, `duplication.py`, `design_guard.py`, `skills_policy.py --check`) and the hooks are proven by the kit's own suite. `G selftest` runs it: every guard is seen failing on a planted case and passing on a clean one, including every false pass found in earlier reviews. `G skills --evals` checks real-agent skill routing. A commit containing a violation is rejected by `.githooks/pre-commit`, and a suppression typed by Claude is blocked by the pre-edit hook.

## Record in the blueprint

Paste the `PROVED …` lines from `G prove` and the CI run link into `BLUEPRINT.md` §8. **Any gate that cannot go red is BLOCKED; `ready` stays false.**
