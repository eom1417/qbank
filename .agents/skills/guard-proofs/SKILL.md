---
name: guard-proofs
description: Prove each configured quality gate can actually fail - plant deliberate violations (401-line file, 51-line function, complexity 11, copied block, forbidden import, raw design value, vulnerable dependency, unauthorized access, missing tool), confirm the real gate rejects each, restore, confirm green, and record evidence in the blueprint. Use at bootstrap, after any gate/tool/CI change, or when the user asks "are the guards real", "prove the checks", "اختبر الحراس", "تأكد إن الفحوصات حقيقية".
---

# guard-proofs

`G` = `python3 .genesis/tools/genesis.py`. Procedure: `.genesis/docs/17_GUARD_PROOFS.md`.

1. For each configured gate, `.genesis/proofs/<gate>/` (or `.genesis/proofs/<gate>/<n>/` per command) holds `.probe` fixtures that violate exactly what the gate checks, in **each** code language for function gates. Add `expect.txt` only when the failure names something other than the fixture (a test name, a package).
2. `G prove`. Every gate must print `PROVED`. `UNPROVEN ... still PASSES` means the gate does not check what its name says: fix the command or tool, never bend the fixture to fit.
3. `G selftest` (the kit's own guards) and, if the Claude CLI exists, `G skills --evals`.
4. Paste the PROVED lines into `BLUEPRINT.md` §8.

A gate that cannot go red is **BLOCKED**: replace the tool. Never mark it done, never set `ready=true` around it, never edit `.genesis/proofs.json` by hand.
