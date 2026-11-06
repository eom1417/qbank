# Contributing / المساهمة

Thank you for helping QBank. / شكراً لمساعدتك في QBank.

- **Found a problem?** In QBank: Help → **Send feedback** opens a filled-in issue. Or open one here
  with a template (problem, a file read badly, an idea). Never attach a file or a question you are
  not allowed to share.
- **Want to change code?** Read `AGENTS.md` (the engineering contract) and `BLUEPRINT.md` (who owns
  what). Every change keeps files ≤ 400 lines, functions ≤ 50 lines and complexity ≤ 10, comes with
  tests of the success and the refused path, and passes `python3 .genesis/tools/genesis.py check`.
  Commits follow Conventional Commits (`fix(sources): …`).
- **Pull requests** run the full gate in CI; a change to policy files (CI, guards, `engineering.json`,
  `CODEOWNERS`) needs the owner's `policy-change` label.
- **Development setup:** `bash setup.sh` (PostgreSQL for tests, Playwright, the AI host, hooks).

By contributing you agree that your contribution is licensed under the MIT License (`LICENSE`).
