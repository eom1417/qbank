# Primary references (verify the installed version before relying on a command)

## Agents and skills

- Agent Skills specification (SKILL.md format): https://agentskills.io/specification
- Claude Code skills, hooks, memory (`@AGENTS.md` imports): https://code.claude.com/docs/en/skills · https://code.claude.com/docs/en/hooks · https://code.claude.com/docs/en/memory
- Codex (AGENTS.md, `.agents/skills`): https://developers.openai.com/codex · AGENTS.md convention: https://agents.md
- skills.sh installer (`npx skills`, pinned 1.7.4): https://skills.sh · https://github.com/vercel-labs/skills
- Matt Pocock skills (checked at commit `4ae2317`, Oct 31 2026): https://github.com/mattpocock/skills — its upstream files `.agents/install-block.md` (install routes) and `.agents/invocation.md` (model- vs user-invoked) explain the conventions this kit relies on
- Superpowers (checked at `2ce8aa1`, Oct 21 2026): https://github.com/obra/superpowers
- Anthropic skills (checked at `ca45fc4`, Oct 28 2026): https://github.com/anthropics/skills

## Quality and architecture tools

- lizard (multi-language CCN/length, pinned 1.24.3): https://github.com/terryyin/lizard
- ESLint `complexity`, `max-lines`, `max-lines-per-function`: https://eslint.org/docs/latest/rules/
- Ruff (C901, pylint rules): https://docs.astral.sh/ruff/rules/
- dependency-cruiser: https://github.com/sverweij/dependency-cruiser · import-linter: https://import-linter.readthedocs.io/
- jscpd: https://github.com/kucherenko/jscpd · Knip: https://knip.dev/ · vulture: https://github.com/jendrikseipp/vulture
- golangci-lint v2 linters (gocyclo, funlen, depguard, dupl, unused, gosec): https://golangci-lint.run/usage/linters/
- Vulnerable dependencies: pip-audit https://github.com/pypa/pip-audit · npm audit https://docs.npmjs.com/cli/commands/npm-audit · govulncheck https://go.dev/doc/security/vuln/
- Claude Code hook permission decisions (`ask`): https://code.claude.com/docs/en/hooks · Codex skills (`.agents/skills`, `allow_implicit_invocation`): https://learn.chatgpt.com/docs/build-skills
- Stylelint `declaration-strict-value`: https://github.com/AndyOGo/stylelint-declaration-strict-value
- Style Dictionary (multi-platform tokens): https://styledictionary.com/
- axe-core: https://github.com/dequelabs/axe-core · Playwright: https://playwright.dev/

## Security and delivery

- OWASP ASVS: https://asvs.owasp.org/ · MASVS: https://mas.owasp.org/ · Cheat Sheets: https://cheatsheetseries.owasp.org/
- OWASP Top 10 for LLM applications: https://genai.owasp.org/
- Gitleaks: https://github.com/gitleaks/gitleaks · OSV-Scanner: https://github.com/google/osv-scanner · Semgrep CE: https://semgrep.dev/docs/
- GitHub Actions secure use and SHA pinning: https://docs.github.com/en/actions/reference/security/secure-use
- Protected branches and CODEOWNERS: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository
- Conventional Commits: https://www.conventionalcommits.org/

Pinned in this kit (verified Nov 2 2026):
- `actions/checkout` v6.1.0 = `d23441a48e516b6c34aea4fa41551a30e30af803`; `actions/setup-python` v7.1.0 = `6d4fd22b20465ccc0f7354476588e8df7c9ca0e0` (`git ls-remote`).
- Kit tools with sha256 (PyPI): lizard 1.24.3, pathspec 1.1.1, pygments 2.21.0 (`.genesis/tools/requirements-guard.txt`).
- Recipe tools: golangci-lint v2.15.0, govulncheck v1.9.0, pip-audit 2.10.1, @types/node 26.6.6 (others in each `recipe.json`).
- Upstream skill repositories at the commits above; every skill they contain is classified in `engineering.json`.

A URL is reference material, not evidence that anything was installed, configured or run.
