# M17.4 Independent security review

Date: 2026-11-04. Scope: the whole codebase on `main`, reviewed by three independent reviewers (`boundary-review`):

1. identity and pairing
2. untrusted files (uploads, PDF tools, export ZIPs, backups)
3. AI integration and per-owner authorization

`npm audit` was also run. Every fix below has a regression test.

## Fixed

| #   | Severity                    | Finding                                                                                                                                                        | Fix                                                                                                                                                                          | Test                               |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | High (accounts mode)        | Any account could change the shared AI host's settings, including a provider's program path (command execution), install providers, and sign the operator out. | Outside local mode the providers API is look-only (`KitReadMethod`); settings, installs, sign-in flows and CLI login are registered only where the account runs the install. | `providers-unavailable.test.ts`    |
| 2   | Medium-high (accounts mode) | Password-reset links were built from the request's Origin and Host, so a forged request mailed a real token to an attacker's site.                             | Links use the configured `QBANK_ALLOWED_ORIGINS[0]`; without it the endpoint refuses.                                                                                        | `security-identity.test.ts`        |
| 3   | Medium                      | A prompt in a user's PDF could make a provider agent read files in its working folder, which was the kit's home (settings, secrets).                           | Turns run in an empty `workdir` of their own (mode 700). The host token leaves the environment at start, so no CLI or turn inherits it.                                      | ai-host start-up (folder verified) |
| 4   | Medium (accounts mode)      | No limit on sign-in guesses or reset emails.                                                                                                                   | 10 wrong passwords per address and per email in 15 minutes; 5 reset emails per inbox and 30 per address an hour.                                                             | `security-identity.test.ts`        |
| 5   | Medium                      | A restore ZIP could name one 50 MB picture on thousands of questions (disk flood), or claim many large entries (memory).                                       | One stored copy per entry; at most 512 MB unpacked and 20,000 entries.                                                                                                       | `security-files.test.ts`           |
| 6   | Low-medium                  | The attempt limiter grew without bound under spoofed addresses; `trustProxy: true` trusted every hop.                                                          | Empty keys removed, at most 10,000 keys; only loopback proxies are trusted.                                                                                                  | `attempts.test.ts`                 |
| 7   | Low                         | A crafted giant PDF page rendered into gigabytes.                                                                                                              | Pages over 2,000 pt (about 70 cm) are refused on upload (`page_too_large`).                                                                                                  | `security-files.test.ts`           |
| 8   | Low                         | A failed restore left a half-made bank and orphan files.                                                                                                       | Everything the restore made is removed on failure.                                                                                                                           | `security-files.test.ts`           |
| 9   | Low                         | No way to cut off a lost phone or a shared link.                                                                                                               | Settings → Your other devices → "Sign out every other device" signs the others out and replaces the pairing code.                                                            | `security-local.test.ts`           |
| 10  | Low                         | CLI sign-in sessions stayed in memory forever.                                                                                                                 | Removed 5 minutes after they end.                                                                                                                                            | —                                  |
| 11  | Moderate (dependency)       | `@fastify/static` 10.1.8 pulled vulnerable `glob`/`minimatch`.                                                                                                 | 10.1.10: `npm audit --omit=dev` reports 0.                                                                                                                                   | `npm audit`                        |

## Accepted, with the reason

- **TCP tunnels.** A raw TCP tunnel (ssh `-R`, socat) makes remote requests look local. For installs reached that way, `QBANK_REQUIRE_PAIRING_CODE=true` makes this computer pair with the code too.
- **Plain HTTP on the LAN.** With `--lan`, QBank uses plain HTTP, so someone on the same Wi-Fi who can watch traffic could take a session cookie. Use a trusted network, or an HTTPS route as in development. "Sign out every other device" ends any such session.
- **File reads by agents.** A provider agent in a read-only sandbox (Codex) may still read files outside its working folder if a PDF prompts it. In local mode the reply stays in the owner's own database, and every AI-read question waits for review.
- **Development-only `minimatch`.** One moderate `minimatch` advisory remains in the lint tools (eslint, typescript-eslint). They never run in the app, and their inputs are our own globs.

## Checked and fine

- The service worker caches no `/api` data.
- No `dangerouslySetInnerHTML` or `innerHTML`; AI text is always escaped.
- The HTML results report escapes every value.
- External tools are run without a shell and with fixed arguments.
- ZIP entry names are on an allowlist (no ZIP slip).
- Media is served as `image/png` with `nosniff`.
- Backup ids are checked against a strict pattern, and backup SQL quotes every identifier.
- Every query by id is scoped to its owner (automated scan of every select, update and delete).
- Token comparisons are constant-time; session tokens are stored only as hashes.
