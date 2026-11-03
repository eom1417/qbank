import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

import { askOnce } from './ask.ts';

const MAX_IMAGE_BASE64 = 14 * 1024 * 1024;

/** `POST /ask`: one prompt, optionally with one PNG page image, to one provider instance. */
const AskRequest = Schema.Struct({
  instanceId: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  model: Schema.optional(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))),
  prompt: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(40_000)),
  imagePngBase64: Schema.optional(Schema.String.check(Schema.isMaxLength(MAX_IMAGE_BASE64))),
  timeoutMs: Schema.optional(
    Schema.Int.check(Schema.isBetween({ minimum: 5_000, maximum: 600_000 })),
  ),
});

export interface AskReply {
  readonly status: number;
  readonly body: unknown;
}

/** Runs one question and maps its outcome to a reply (422 with the provider's reason). */
export const handleAsk = Effect.fn('handleAsk')(function* (input: unknown, cwd: string) {
  const request = yield* Schema.decodeUnknownEffect(AskRequest)(input).pipe(Effect.option);
  if (request._tag === 'None')
    return {
      status: 400,
      body: { error: { _tag: 'InvalidInput', message: 'The question does not match.' } },
    } satisfies AskReply;
  const { imagePngBase64, timeoutMs, ...rest } = request.value;
  const image =
    imagePngBase64 === undefined
      ? undefined
      : yield* Schema.decodeEffect(Schema.Uint8ArrayFromBase64)(imagePngBase64).pipe(Effect.option);
  if (image?._tag === 'None')
    return {
      status: 400,
      body: { error: { _tag: 'InvalidInput', message: 'The image is not base64.' } },
    } satisfies AskReply;
  const result = yield* askOnce({
    ...rest,
    cwd,
    image: image?.value,
    timeoutMs: timeoutMs ?? 180_000,
  }).pipe(Effect.result);
  if (result._tag === 'Success') return { status: 200, body: result.success } satisfies AskReply;
  const failure = result.failure;
  const body =
    failure._tag === 'AskFailed'
      ? { error: { _tag: 'AskFailed', reason: failure.reason, detail: failure.detail } }
      : {
          error: {
            _tag: 'AskFailed',
            reason: failure._tag,
            detail: 'The provider could not run this question.',
          },
        };
  return { status: 422, body } satisfies AskReply;
});
