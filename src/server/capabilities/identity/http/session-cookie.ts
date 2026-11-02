import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IssuedSession } from '../use-cases/sessions.js';

const SESSION_COOKIE = 'qb_session';

export function readSessionToken(request: FastifyRequest): string | undefined {
  return request.cookies[SESSION_COOKIE];
}

export function setSessionCookie(reply: FastifyReply, session: IssuedSession, secure: boolean) {
  reply.setCookie(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    expires: session.expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply, secure: boolean) {
  reply.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure, path: '/' });
}
