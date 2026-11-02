---
name: safe-refactor
description: Behavior-preserving restructuring - split oversized files/functions, move duplicated code onto one owner, fix boundaries, or bring an existing repository under the Genesis contract in small verified batches. Use when the user asks to refactor, clean up, reorganize, split a file, remove duplication, or apply this kit to an existing project ("نظف الكود", "أعد التنظيم", "قسم الملف", "شيل التكرار", "طبق الدليل على مشروع قائم").
---

# safe-refactor

`G` = `python3 .genesis/tools/genesis.py`.

1. **Baseline:** run the current tests, `G guard`, `G guard --functions` and `G duplication`; record the violation list. For an existing repo use `.genesis/prompts/05_ADOPT_EXISTING.md`.
2. **Pin behavior:** add characterization tests around code you will move if coverage is missing.
3. **One batch = one reason** (one owner, one split, or one duplicate removed). Load `codebase-design` for module seams if installed.
4. **Split by responsibility,** not by line count: extract cohesive units with clear names into the owning module; shared logic moves to its named owner (`.genesis/docs/10`), never a `utils` bucket.
5. After each batch: tests green, violation count lower, no public contract change unless approved.
6. Report each batch: what moved, why that owner, before/after violation counts, tests.

Never mix refactor and behavior change in one batch. Never add suppressions or baselines to reach green.
