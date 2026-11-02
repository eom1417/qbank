# Independent review request

Load the `boundary-review` skill (by name, no slash); add `code-review` if installed. Review the actual diff from the stated base, not the author's summary.

Only report: user-visible breakage, data loss, security or tenant bypass, contract drift, wrong or duplicated owner, import cycles or boundary violations, 400/50/10 or suppression, missing evidence, out-of-scope edits. Reproduce plausible blockers with focused tests. Verdict **APPROVED** or **FIX BLOCKERS** with path:line, evidence and the minimum correction. Style ideas go to a short backlog. Do not redesign, weaken guards, merge or deploy.

**Base / head / PR link and the approved scope:**

[paste]
