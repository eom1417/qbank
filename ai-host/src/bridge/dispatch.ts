import * as Effect from 'effect/Effect';

import { decodePayload, encodeFailure, encodeSuccess } from './rpc.ts';
import type { CallContext, UnaryHandler } from './types.ts';

export interface Reply {
  readonly status: number;
  readonly body: unknown;
}

const invalid = (message: string): Reply => ({
  status: 400,
  body: { error: { _tag: 'InvalidInput', message } },
});

/**
 * One call: decode with the kit's schema, run its single service call, encode the reply. A
 * declared failure goes back encoded (422); anything else is an internal error without detail.
 */
export const dispatch = Effect.fn('dispatch')(function* (
  methods: Readonly<Record<string, UnaryHandler>>,
  method: string,
  input: unknown,
  context: CallContext,
) {
  const handler = methods[method];
  if (!handler)
    return { status: 404, body: { error: { _tag: 'UnknownMethod', method } } } satisfies Reply;
  const payload = yield* decodePayload(method, input).pipe(Effect.option);
  if (payload._tag === 'None') return invalid('The request does not match the method.');
  const result = yield* handler(payload.value as never, context).pipe(Effect.result);
  if (result._tag === 'Failure') {
    const encoded = yield* encodeFailure(method, result.failure);
    return encoded._tag === 'Some'
      ? ({ status: 422, body: { error: encoded.value } } satisfies Reply)
      : ({ status: 500, body: { error: { _tag: 'InternalError' } } } satisfies Reply);
  }
  const body = yield* encodeSuccess(method, result.success).pipe(Effect.orDie);
  return { status: 200, body } satisfies Reply;
});
