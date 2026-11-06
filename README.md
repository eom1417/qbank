# QBank Engine

Turn your own medical books and question PDFs into a private question bank, on your own computer.
Open source (MIT). No account, no server, no subscription of ours: you bring your own AI
subscription or key, and your files never leave your machine except what an AI task sends to the
provider you chose.

> **بالعربي:** QBank يحوّل كتبك وملفات أسئلتك إلى بنك أسئلة خاص بك، على جهازك أنت. مفتوح المصدر
> (MIT)، بلا حساب ولا خادم ولا اشتراك عندنا. تربط اشتراكك أو مفتاحك في Claude أو ChatGPT أو غيرهما.
> الأسهل: ثبّت Docker Desktop مرة، ثم `docker compose up -d` وافتح `http://localhost:3000`. أو بلا Docker: `bash scripts/install.sh` ثم `qbank`.
> ويمكن تشغيله منصة بحسابات، لكل حساب ربط ذكاء اصطناعي خاص به، وقنوات نشر لـagents (واتساب، تيليجرام).

## Install and run

### The easiest way: Docker (Windows, macOS, Linux)

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) once, then:

```bash
git clone https://github.com/eom1417/qbank.git qbank && cd qbank
docker compose up -d                   # first time: builds QBank (about 10 minutes)
```

Open **http://localhost:3000**. Your data stays in Docker's `qbank-data` volume across updates
(`git pull && docker compose up -d --build`). QBank is reachable from this computer only.

### Without Docker

One command on macOS (Homebrew) and Linux (apt or dnf). It needs Node.js 24.10+ (on macOS it
installs it with Homebrew), and it is safe to run again: it only adds what is missing.

```bash
git clone https://github.com/eom1417/qbank.git qbank && cd qbank
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

## What it does

- **Imports** text and scanned PDFs (Arabic and English): questions, options, answer keys, answer
  pages at the end of a file, explanations and pictures, kept exactly as printed.
- **Your AI settles the answers** (optional): two independent solvers and a stronger judge, so
  review is left to real conflicts. Separate opt-in improvements: complete the options, polish the
  wording (a guard rejects any change to numbers, units or negations), a topic review with checked
  sources for incomplete questions, outdated-answer notes, classification, similar questions.
- **Study:** Tutor and timed exams, Smart Mix and spaced repetition, mastery and analytics, topic
  cards, private notes, search.
- **Your data:** daily backups, export and restore of a bank (with the AI's work), deletion with an
  honest report.
- **Publishing channels:** an outside agent (WhatsApp, Telegram, n8n, any MCP agent) takes a bank's
  questions in batches that never repeat, with the channel's own key. Each channel keeps its own
  numbers, apart from your study. See [`docs/CHANNELS.md`](docs/CHANNELS.md).

## Run it as a shared server

`QBANK_MODE=accounts` (with `DATABASE_URL` for PostgreSQL) gives sign-up and sign-in. Each account
links its own AI providers in its own AI host, started on demand and isolated in its own folder;
nobody can use another account's sign-in. Installing and updating the provider tools stays with
whoever runs the server. Settings and limits: [`docs/reports/m22-provider-isolation.md`](docs/reports/m22-provider-isolation.md).

## Guides and reports

- User guide: [`docs/USER-GUIDE.ar.md`](docs/USER-GUIDE.ar.md) (العربية) · [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md) (English).
- Acceptance, security, performance and handoff: `docs/reports/`.

## For developers

The engineering contract is `AGENTS.md`; the owner map is `BLUEPRINT.md`; decisions are in
`docs/DECISIONS.md`. Gates: see `engineering.json → checks`. `bash setup.sh` prepares a full
development environment (PostgreSQL for tests, Playwright, hooks).

## License

MIT, see `LICENSE`. Third-party notices: `NOTICE.md`.
