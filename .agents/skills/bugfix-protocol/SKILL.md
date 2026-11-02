---
name: bugfix-protocol
description: Fix a defect with proof - reproduce it, write a regression test that fails, patch the owning module only, show red then green, keep everything else unchanged. Use when the user reports a bug, error, crash, failing test, wrong output or regression ("fix this bug", "it's broken", "debug", "صلح الخطأ", "فيه مشكلة", "ما يشتغل", "ليش يطلع خطأ").
---

# bugfix-protocol

`G` = `python3 .genesis/tools/genesis.py`.

1. **Reproduce** with the exact input/steps. For hard cases load `diagnosing-bugs` (or `systematic-debugging`) if installed. No fix before a confirmed root cause.
2. **Locate the owner** of the broken rule via `BLUEPRINT.md`. Fix it there, never with a workaround in the caller.
3. **Regression test first:** it must fail on the current code for the reported reason (red). Keep it permanently.
4. **Minimal patch** in the owner. If callers duplicated the bug, consolidate them onto the owner instead of patching each copy.
5. **Green:** the regression test, the owner's tests, `G check`, then `G check --full` once.
6. **Report:** root cause (one sentence), red->green evidence, files touched, residual risk.

Do not widen scope, refactor unrelated code, delete tests, or weaken assertions to get green.
