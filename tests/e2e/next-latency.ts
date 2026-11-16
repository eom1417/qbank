import type { Page } from '@playwright/test';

/** A slow mobile line, as Chrome's "Slow 3G" (M34 U3): 400 kb/s, 400 ms for each round trip. */
export async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  const bytesPerSecond = (400 * 1024) / 8;
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,
    downloadThroughput: bytesPerSecond,
    uploadThroughput: bytesPerSecond,
  });
}

/**
 * Clicks "Next" inside the page and measures, in milliseconds, how long until `shown` (the next
 * question's place, e.g. "السؤال 2 من 5") is on the screen. Gives up after five seconds.
 */
export async function msToNext(page: Page, shown: string, next = 'التالي'): Promise<number> {
  // Whatever was read ahead has arrived: nothing is left on the wire.
  await page.waitForLoadState('networkidle');
  return page.evaluate(
    ([label, text]) =>
      new Promise<number>((resolve, reject) => {
        const button = [...document.querySelectorAll('button')].find(
          (b) => b.textContent?.trim() === label,
        );
        if (!button) return reject(new Error(`no button «${label}»`));
        const start = performance.now();
        const seen = () => document.body.innerText.includes(text);
        const observer = new MutationObserver(() => {
          if (!seen()) return;
          observer.disconnect();
          resolve(performance.now() - start);
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        setTimeout(() => reject(new Error(`«${text}» not shown in 5 s`)), 5000);
        button.click();
      }),
    [next, shown] as const,
  );
}
