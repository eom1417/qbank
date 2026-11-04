const ESC = String.fromCharCode(27);
const BELL = String.fromCharCode(7);
/** Terminal colours, cursor moves and titles: a CLI in a terminal prints them around its text. */
const CONTROL = new RegExp(
  `${ESC}\\[[0-9;?]*[ -/]*[@-~]|${ESC}\\][^${BELL}]*${BELL}|${ESC}[()][A-Z0-9]|\\r`,
  'g',
);
const LINK = /https:\/\/[^\s"'<>]+/;
/** Codex's one-time device code, e.g. ABCD-12EFG. */
const DEVICE_CODE = /\b[A-Z0-9]{4}-[A-Z0-9]{4,6}\b/;

export const plainText = (raw: string) => raw.replace(CONTROL, '');

/** The sign-in link and the device code, once the CLI has printed them. */
export function readPrompt(text: string) {
  const link = LINK.exec(text)?.[0] ?? null;
  const code = DEVICE_CODE.exec(text)?.[0] ?? null;
  return { link, code };
}

/** The CLI's last words, for a failure the owner can act on; nothing typed into it is repeated. */
export function lastLine(text: string, hide: readonly string[]) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !hide.some((secret) => secret && line.includes(secret)));
  return (lines.at(-1) ?? '').slice(0, 300);
}
