# Delivery workflow — lean, safe, repeatable

## For every change

1. **Scope**: One-sentence goal, expected behavior, non-goals, concrete acceptance cases and risk level.
2. **Locate**: Search authoritative owner, direct dependencies, callers, existing primitives, tests, open changes.
3. **Impact**: Identify code paths and compatibility requirements. Prefer minimal change surface.
4. **Implement**: One coherent vertical slice; reuse existing contracts and components; no unrelated cleanup.
5. **Test**: One focused regression + positive/negative case as relevant. Run fast checks.
6. **Review**: Diff only; security/contract impacts, suspicious permissions, new dependencies, copy-paste and generated artifacts.
7. **Deliver**: One reviewable PR where practical, full check on final tree, honest test report, no auto-merge.

## Risk-based review, not bureaucracy

| Risk | Extra evidence |
|---|---|
| Docs or isolated pure calculation | relevant targeted tests and fast gates |
| User-visible flow or API | integration/contract tests |
| Identity, secrets, billing, data deletion, migration | negative security tests, rollback, independent focused review |
| Infrastructure/deploy | staged verification, health check, rollback and explicit approval |

## Worktree and Git safety

- Use feature branches/worktrees when multiple agents or long-running work overlap. A single developer does not need dozens of branches.
- Inspect `git status`, track changes already present, preserve all unknown/untracked files. Never reset/clean/force-delete branches to simplify a report.
- No commit, merge, deployment or irreversible data action unless the owner has authorized it under the project's workflow.
- Change only needed files; preserve untouched behavior; update affected docs and tests together.
- No permission to change policy/gate settings while implementing a feature. Gate updates are a separate, reviewed architecture decision and cannot weaken hard limits.

## Git conventions

- Branches: `feat/<short-topic>`, `fix/<short-topic>`, `refactor/<…>`, `chore/<…>`, `docs/<…>`.
- Commits: Conventional Commits (`feat(billing): add proration`, `fix(auth): reject expired refresh token`). One logical change per commit; the message says why when it is not obvious.
- PRs use `.github/pull_request_template.md`; small enough to review in one sitting (guideline: under ~400 changed lines excluding lockfiles/generated).
- Hooks: `python3 .genesis/tools/genesis.py hooks` once per clone (pre-commit = fast gate, commit-msg = Conventional Commits, pre-push = full gate). `--no-verify` and `commit -n` are forbidden; Claude hooks deny them and CI repeats every check anyway.
- Protect the main branch with one approved command: `python3 .genesis/tools/genesis.py governance --plan` shows the change, `--apply` (after the owner approves; it changes the GitHub repository) creates the `policy-change` label and requires the *Engineering quality* check, no force push and no deletion, plus a Code Owner review when the repository has 2+ collaborators. `--verify` reads the live settings back. `.github/CODEOWNERS` assigns every kit/policy path to the owner; the project's own folders need no entry.

## Release criteria

- Required CI passes on final revision, branch protection configured as appropriate to platform/cost.
- Security/data/integration risks closed or explicitly blocked from release.
- Config/secret/backup/rollback/observability tested in actual target environment. No unverified production readiness claim.
