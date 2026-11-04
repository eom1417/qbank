# QBank Engine

Turn your own medical books and question PDFs into a private question bank, on your own computer.
Open source (MIT). No account, no server, no subscription of ours: you bring your own AI
subscription or key, and your files never leave your machine except what an AI task sends to the
provider you chose.

> **بالعربي:** QBank يحوّل كتبك وملفات أسئلتك إلى بنك أسئلة خاص بك، على جهازك أنت. مفتوح المصدر
> (MIT)، بلا حساب ولا خادم ولا اشتراك عندنا. تربط اشتراكك أو مفتاحك في Claude أو ChatGPT أو غيرهما.
> التثبيت بأمر واحد: `bash scripts/install.sh` ثم `qbank` ويفتح في المتصفح. على ويندوز داخل WSL.

## Install and run

One command on macOS (Homebrew) and Linux (apt or dnf). It needs Node.js 24.10+ (on macOS it
installs it with Homebrew), and it is safe to run again: it only adds what is missing.

```bash
git clone <this repository> qbank && cd qbank
bash scripts/install.sh                # reading tools, packages, the AI kit, the build, a `qbank` command
qbank                                  # starts QBank and opens http://127.0.0.1:3000
```

- **Windows:** QBank runs inside WSL, with the browser on Windows. In PowerShell run `wsl --install`
  once (restart when asked), then, in this folder, `wsl bash scripts/install.sh` and `wsl qbank`.
- `bash scripts/install.sh --check` lists what is missing and changes nothing;
  `--with-ai-clis` also installs the official Codex and Claude Code CLIs.
- **Your data** stays in `.data/app/` (database, files, AI provider settings). QBank backs it up
  every day (Settings → Backups), and can copy each backup to a folder your cloud app syncs.
- **AI:** Settings → AI providers. Sign in to Codex (ChatGPT) or Claude from there, from any device.
- **Phone on the same Wi-Fi:** `qbank --lan`, then scan the QR code in Settings → Your other
  devices. Anyone with that link can open your QBank: "Sign out every other device" cuts it off.
- `qbank --no-open` starts without opening a browser.

## For developers

The engineering contract is `AGENTS.md`; the owner map is `BLUEPRINT.md`; decisions are in
`docs/DECISIONS.md`. Gates: see `engineering.json → checks`. `bash setup.sh` prepares a full
development environment (PostgreSQL for tests, Playwright, hooks).

## License

MIT, see `LICENSE`. Third-party notices: `NOTICE.md`.
