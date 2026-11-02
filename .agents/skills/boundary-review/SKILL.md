---
name: boundary-review
description: Independent review (including security review) of a diff, PR, branch or architecture change in a Genesis project for authorization or tenant bypass, data loss, contract drift, duplicated business logic, wrong owner, import cycles, raw design values, 400/50/10 violations and unrelated edits. Use instead of generic review/security-review commands whenever the user asks to review, security-review, audit, check a PR, assess release readiness or "is this safe to merge" ("راجع", "دقق", "هل جاهز للدمج", "راجع أمنياً").
---

# boundary-review

Read the actual diff from the stated base, not the author's summary. Load `.genesis/docs/03`, `.genesis/docs/05` and the `BLUEPRINT.md` owner rows only for touched areas.

- Trace each changed entry point: input validation -> authorization -> domain owner -> persistence.
- Look for a second copy of an existing rule, contract, validator, token or component.
- Confirm imports respect the allowed direction; no new cycle; no internal import across capabilities.
- Confirm gates ran: missing evidence is UNKNOWN, never PASS. Re-run focused tests for any plausible blocker.
- Check the diff contains nothing outside the stated scope and no policy file without the `policy-change` reason.

Output (`.genesis/docs/16` format): **APPROVED** or **FIX BLOCKERS**, each blocker with path:line, evidence and the minimum correction. Non-blocking ideas go to a short backlog. Never merge, deploy, or print secrets.
