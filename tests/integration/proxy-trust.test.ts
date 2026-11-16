import { describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { useTestApp } from '../support/test-app.js';

// Behind Cloudflare Tunnel -> Traefik (Coolify): Traefik connects from its Docker network and
// replaces X-Forwarded-For with the tunnel's address; only Cloudflare's own headers name the
// visitor. Those count only when every hop is a proxy we run, so nobody can forge an address.
const TRAEFIK = '10.0.2.5';
const TUNNEL = '10.0.1.1';
const PUBLIC = 'https://qbank.test';
const app = useTestApp({
  proxy: { trusted: ['10.0.2.0/24', TUNNEL], headers: 'cloudflare' },
  extraOrigins: [PUBLIC],
});

interface Hop {
  socket: string;
  forwardedFor?: string;
  visitor?: string;
  scheme?: 'http' | 'https';
}

function headersOf(hop: Hop): Record<string, string> {
  const headers: Record<string, string> = { origin: PUBLIC, host: 'qbank.test' };
  if (hop.forwardedFor) headers['x-forwarded-for'] = hop.forwardedFor;
  if (hop.visitor) headers['cf-connecting-ip'] = hop.visitor;
  if (hop.scheme) headers['cf-visitor'] = JSON.stringify({ scheme: hop.scheme });
  return headers;
}

let inbox = 0;
/** A wrong password for a fresh e-mail each time: only the address limit can pause it. */
function wrongSignIn(server: FastifyInstance, hop: Hop) {
  inbox += 1;
  return server.inject({
    method: 'POST',
    url: '/api/auth/sign-in',
    remoteAddress: hop.socket,
    headers: headersOf(hop),
    payload: { email: `nobody-${inbox}@example.com`, password: 'wrong password value' },
  });
}

const throughTunnel = (visitor: string): Hop => ({
  socket: TRAEFIK,
  forwardedFor: TUNNEL,
  visitor,
  scheme: 'https',
});

async function exhaust(make: (i: number) => Hop) {
  for (let i = 0; i < 10; i++) expect((await wrongSignIn(app(), make(i))).statusCode).toBe(401);
  return wrongSignIn(app(), make(10));
}

describe('visitor addresses behind trusted proxies', () => {
  it('keeps a separate sign-in limit for each visitor behind the tunnel', async () => {
    const paused = await exhaust(() => throughTunnel('198.51.100.1'));
    expect(paused.statusCode).toBe(429);
    expect((await wrongSignIn(app(), throughTunnel('198.51.100.2'))).statusCode).toBe(401);
  });

  it('ignores forged Cloudflare and forwarded headers sent straight to the server', async () => {
    const paused = await exhaust((i) => ({
      socket: '203.0.113.9',
      forwardedFor: `192.0.2.${i}`,
      visitor: `192.0.2.${100 + i}`,
    }));
    expect(paused.statusCode).toBe(429);
  });

  it('ignores a forged visitor address that reached Traefik without the tunnel', async () => {
    const paused = await exhaust((i) => ({
      socket: TRAEFIK,
      forwardedFor: '192.168.1.50',
      visitor: `192.0.2.${i}`,
    }));
    expect(paused.statusCode).toBe(429);
  });
});

describe('https only behind the tunnel', () => {
  const get = (url: string, hop: Hop, host = 'qbank.test') =>
    app().inject({
      method: 'GET',
      url,
      remoteAddress: hop.socket,
      headers: { ...headersOf(hop), host },
    });

  it('sends an http visitor to https, keeping the path and the query', async () => {
    const hop = { ...throughTunnel('198.51.100.7'), scheme: 'http' as const };
    const moved = await get('/api/health?a=1&b=two', hop);
    expect([moved.statusCode, moved.headers.location]).toEqual([
      308,
      `${PUBLIC}/api/health?a=1&b=two`,
    ]);
  });

  it('serves https visitors with HSTS', async () => {
    const served = await get('/api/health', throughTunnel('198.51.100.8'));
    expect(served.statusCode).toBe(200);
    expect(served.headers['strict-transport-security']).toBe('max-age=15552000');
  });

  it('never redirects on forged headers, to a host it does not serve, or without the tunnel', async () => {
    const forged = { socket: '203.0.113.9', visitor: '192.0.2.1', scheme: 'http' as const };
    const elsewhere = { ...throughTunnel('198.51.100.9'), scheme: 'http' as const };
    expect((await get('/api/health', forged)).statusCode).toBe(200);
    expect((await get('/api/health', elsewhere, 'evil.example')).statusCode).toBe(200);
    expect((await get('/api/health', { socket: '127.0.0.1' })).statusCode).toBe(200);
  });
});
