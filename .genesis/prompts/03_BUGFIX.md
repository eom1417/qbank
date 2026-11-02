# Bug fix request

Load the `bugfix-protocol` skill (by name, no slash); add `diagnosing-bugs` or `systematic-debugging` if installed and the cause is not obvious.

Order is mandatory: reproduce → root cause in one sentence → regression test that fails for that reason (show red) → minimal fix in the owning module → green on the regression, the owner's tests, `python3 .genesis/tools/genesis.py check`, then `--full` once. If the same bug was copied elsewhere, consolidate onto the owner instead of patching copies. No unrelated changes, no weakened assertions, no deleted tests. Do not merge or deploy.

**Symptom / steps to reproduce / expected vs actual / logs:**

[paste]
