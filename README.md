# QBank Engine

Turn your own medical books and question PDFs into a private question bank, on your own computer.
Open source (MIT). No account, no server, no subscription of ours: you bring your own AI
subscription or key, and your files never leave your machine except what an AI task sends to the
provider you chose.

> **بالعربي:** QBank يحوّل كتبك وملفات أسئلتك إلى بنك أسئلة خاص بك، على جهازك أنت. مفتوح المصدر
> (MIT)، بلا حساب ولا خادم ولا اشتراك عندنا. تربط اشتراكك أو مفتاحك في Claude أو ChatGPT أو غيرهما.
> التشغيل: الأوامر أدناه، ثم `npm run qbank` ويفتح في المتصفح.

## Run it

Tested on Linux (Debian/Ubuntu). Needs Node.js 22+ and `git`.

```bash
git clone <this repository> qbank && cd qbank
npm ci
bash scripts/setup-reading-tools.sh   # PDF and OCR tools (poppler, MuPDF, Tesseract ar+en)
bash scripts/setup-ai-host.sh         # Node 24 and the AI providers kit (for AI features)
npm run qbank                          # builds once, starts, opens http://127.0.0.1:3000
```

- **Your data** stays in `.data/app/` (database, files, AI provider settings). Back it up by copying
  that folder while QBank is stopped.
- **AI:** open Settings → AI providers. Claude Code and Codex use the sign-in already on this computer
  (`claude auth login`, `codex login`); other providers can be added there.
- **Phone on the same Wi-Fi:** `npm run qbank -- --lan` prints a pairing link for your phone. Anyone
  with that link can open your QBank, so keep it to your own devices.
- `npm run qbank -- --no-open` starts without opening a browser.

## For developers

The engineering contract is `AGENTS.md`; the owner map is `BLUEPRINT.md`; decisions are in
`docs/DECISIONS.md`. Gates: see `engineering.json → checks`. `bash setup.sh` prepares a full
development environment (PostgreSQL for tests, Playwright, hooks).

## License

MIT, see `LICENSE`. Third-party notices: `NOTICE.md`.
