# Third-party notices

QBank Engine is MIT-licensed (see `LICENSE`). It includes or depends on:

| Component                           | Where                                                                | License                                           |
| ----------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------- |
| T3 AI Providers Kit (T3 Tools Inc.) | `vendor/t3-ai-providers-kit/`, vendored unmodified                   | MIT, `vendor/t3-ai-providers-kit/kit/LICENSE`     |
| PGlite (ElectricSQL)                | npm `@electric-sql/pglite`                                           | Apache-2.0 (PostgreSQL License for Postgres)      |
| Other npm packages                  | `package-lock.json`, `vendor/t3-ai-providers-kit/kit/pnpm-lock.yaml` | Their own licenses, shipped in `node_modules/`    |
| Poppler, MuPDF, Tesseract           | installed by `scripts/setup-reading-tools.sh`, not bundled           | GPL / AGPL / Apache-2.0, run as separate programs |

AI providers (Claude, ChatGPT/Codex, Cursor, Grok, Gemini and others) are reached with each user's
own account or key. Their terms apply to that use.
