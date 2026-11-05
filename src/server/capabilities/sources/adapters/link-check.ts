/** How long one source page may take to answer. */
const TIMEOUT_MS = 8000;
/** Answers that say the page is gone. Any other answer (even a refusal of robots) means it exists. */
const GONE = new Set([404, 410]);

/**
 * Whether a source's link opens (DEC-34): a link the model cited but that does not exist is
 * dropped, so a note never shows an invented URL. Only http(s) links are tried.
 */
export async function linkOpens(url: string): Promise<boolean> {
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'QBank link check' },
    });
    await response.body?.cancel();
    return !GONE.has(response.status) && response.status < 500;
  } catch {
    return false;
  }
}
