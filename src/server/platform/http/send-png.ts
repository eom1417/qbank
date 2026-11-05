import { createReadStream } from 'node:fs';
import type { FastifyReply } from 'fastify';

/** A stored picture file as a private PNG response (no sniffing, cached by its owner only). */
export const sendPng = (reply: FastifyReply, path: string) =>
  reply
    .type('image/png')
    .header('cache-control', 'private, max-age=3600')
    .header('x-content-type-options', 'nosniff')
    .send(createReadStream(path));
