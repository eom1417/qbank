# Feature request

Load the `feature-delivery` skill (by name, no slash) and follow it with `AGENTS.md` and the blueprint owner map. If `tdd` is installed, load it too.

Before writing code, reply with a 3–6 line impact map: owner capability, entry point → use case → domain → adapter → tests, the existing functions/contracts/components you will reuse, and the files you will touch. Then implement only that.

Rules: 400/50/10 with no suppressions; reuse central owners (functions, contracts, tokens, components); no parallel helpers; no edits outside the impact map; test success and invalid/denied/failure paths; targeted tests → `python3 .genesis/tools/genesis.py check` → `--full` once on the final tree. Report: what changed and why that owner, tests added, gate results, anything unverified. Do not merge or deploy.

**Feature, acceptance cases and constraints:**

[describe the behavior, who can do it, what must be refused, edge cases]
