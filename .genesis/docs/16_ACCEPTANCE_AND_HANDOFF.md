# Done means verifiably correct and cheap to maintain

## Definition of Done — foundation

- Product brief, three core journeys, key risks and non-goals documented in the project-specific blueprint.
- Minimal capability ownership map + allowed/forbidden import boundaries implemented.
- A runnable first vertical slice, including one representative failure path.
- All authored code covered by 400 physical lines/file, 50 physical lines/function and 10 McCabe complexity in its actual language.
- Strict fast/full gates configured; all required tools installed with locked versions and commands verified. No dummy or empty gates.
- Each critical gate demonstrated failing on a temporary deliberately broken fixture and passing again when restored.
- CI runs on every PR; protected branch requires green checks; no weakening of checks to merge work.
- Security/permissions/privacy/operations covered as applicable to actual features, with realistic evidence.
- No hidden duplicate owner for contracts, business rules, data writes, visual tokens or reusable components.
- No default deployment, merge, paid purchase or destructive action without user authorization.
- Project-specific extension instructions show exactly where a new feature, screen, endpoint, migration and test should go (only applicable examples).

## Definition of Done — each change

Correct behavior, smallest coherent scope, no unowned state, no boundary violation, all relevant positive/negative tests, targeted fast gates, final full gate, reviewed diff, compatibility preserved or approved migration, rollback evidence where risk justifies it.

## One-page review output

```text
Decision: READY / BLOCKED
What changed: <affected owners and user-visible behavior>
Why this owner: <one-sentence architecture rationale>
Risk: <data/security/API/compatibility effect or NONE, with basis>
Evidence: <commands, exit status, tests, failed negative cases>
Unverified: <things not actually measured>
Owner approval needed: <only irreversible/expensive/contract-changing decisions>
```

## Session handoff (target 10–20 lines)

```text
Goal / accepted scope:
Branch / commit / worktree state:
Current architecture owner and direct dependencies:
Changes made / why:
Tests run (exact commands and results):
Risks / explicit non-goals:
Next smallest action:
What must NOT be auto-merged/deployed/deleted:
```

## Stop rule

If the latest change is clean, reviewed and approved, **ship the result**; do not invent another review cycle. Stop only for a confirmed blocker, decision that belongs to the owner or missing required verification. Log minor/uncertain concerns without expanding the batch.
