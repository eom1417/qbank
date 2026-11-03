import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import type { ErrorResponse } from '../../../contracts/errors.js';
import { AppError } from '../errors/index.js';

function toAppError(error: FastifyError | AppError): AppError {
  if (error instanceof AppError) return error;
  if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE' || error.statusCode === 413) {
    return new AppError('payload_too_large');
  }
  const status = error.statusCode ?? 500;
  if (status >= 400 && status < 500) return new AppError('validation_failed');
  return new AppError('internal');
}

/** Maps every thrown error to the shared ErrorResponse contract. */
export function handleError(
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  const appError = toAppError(error);
  if (appError.code === 'internal') request.log.error({ err: error }, 'unhandled error');
  const body: ErrorResponse = { error: { code: appError.code } };
  if (appError.fields) body.error.fields = appError.fields;
  return reply.status(appError.httpStatus).send(body);
}

export function handleNotFound(_request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const body: ErrorResponse = { error: { code: 'not_found' } };
  return reply.status(404).send(body);
}
