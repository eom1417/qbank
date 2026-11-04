import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { handleNotFound } from './error-handler.js';

/**
 * Serves the built web app (`npm run build` → dist/web) from the API, so a local install is one
 * address. Unknown non-API paths get index.html (client-side routes); `/api/*` keeps JSON 404s.
 */
export function registerWebApp(app: FastifyInstance, webDir: string | null) {
  const root = webDir === null ? null : resolve(webDir);
  if (root === null || !existsSync(resolve(root, 'index.html'))) {
    app.setNotFoundHandler(handleNotFound);
    return;
  }
  app.register(fastifyStatic, { root, wildcard: false, index: ['index.html'] });
  app.setNotFoundHandler((request, reply) => {
    const isPage = request.method === 'GET' && !request.url.startsWith('/api/');
    return isPage ? reply.sendFile('index.html') : handleNotFound(request, reply);
  });
}
