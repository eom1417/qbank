import type { Page } from '@playwright/test';

/** An ECG strip: pink grid, black trace with regular complexes. */
function ecg() {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [660, 200];
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  c.fillStyle = '#fde4e4';
  c.fillRect(0, 0, 660, 200);
  c.strokeStyle = '#f3b0b0';
  for (let x = 0; x < 660; x += 20) c.strokeRect(x, 0, 20, 200);
  c.strokeStyle = '#000';
  c.lineWidth = 2;
  c.beginPath();
  for (let x = 0; x < 660; x++) {
    const t = x % 110;
    c.lineTo(x, 100 - (t > 50 && t < 56 ? 80 : t > 56 && t < 62 ? -30 : Math.sin(x / 9) * 6));
  }
  c.stroke();
  return canvas.toDataURL('image/png');
}

/** A film like an X-ray or an echo frame: dark, a glow, curved ribs. */
function film({ size, seed }: { size: number; seed: number }) {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [size, size];
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  c.fillStyle = '#111';
  c.fillRect(0, 0, size, size);
  const glow = c.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  glow.addColorStop(0, '#ddd');
  glow.addColorStop(1, '#222');
  c.fillStyle = glow;
  c.fillRect(size * 0.15, size * 0.1, size * 0.7, size * 0.8);
  c.strokeStyle = '#eee';
  c.lineWidth = Math.max(1, size / 60);
  for (let rib = 0; rib < 6; rib++) {
    c.beginPath();
    c.arc(size / 2, size * (0.25 + rib * 0.1) + seed, size * 0.3, Math.PI * 0.1, Math.PI * 0.9);
    c.stroke();
  }
  return canvas.toDataURL('image/png');
}

/** A pale photo with spots (a rash, a skin lesion). */
function photo(hue: number) {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [340, 220];
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  c.fillStyle = `hsl(${hue} 50% 85%)`;
  c.fillRect(0, 0, 340, 220);
  c.fillStyle = `hsl(${hue + 330} 70% 45%)`;
  for (let i = 0; i < 40; i++) c.fillRect((i * 53) % 320, (i * 37) % 200, 14, 10);
  return canvas.toDataURL('image/png');
}

/**
 * Test pictures drawn on canvases (no binary fixtures in git), including a tiny X-ray that is
 * blurry once enlarged (UAT-025).
 */
export async function drawFigures(page: Page): Promise<Record<string, string>> {
  await page.setContent('<!doctype html><title>figures</title>');
  return {
    ecg: await page.evaluate(ecg),
    xray: await page.evaluate(film, { size: 300, seed: 0 }),
    echo: await page.evaluate(film, { size: 320, seed: 6 }),
    blurry: await page.evaluate(film, { size: 14, seed: 0 }),
    photo: await page.evaluate(photo, 30),
    rash: await page.evaluate(photo, 10),
  };
}
