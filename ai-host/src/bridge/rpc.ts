import { WsRpcGroup } from '@t3tools/contracts';
import * as Effect from 'effect/Effect';
import * as RpcSchema from 'effect/rpc/RpcSchema';
import * as Schema from 'effect/Schema';

/** T3's own definition of a wire method: its payload, success and error schemas. */
function rpcOf(method: string) {
  const rpc = WsRpcGroup.requests.get(method);
  if (!rpc) throw new Error(`unknown kit method ${method}`);
  return rpc;
}

/** Decodes a request with the kit's schema, so every surface keeps T3's wire truth. */
export const decodePayload = (method: string, input: unknown) =>
  Schema.decodeUnknownEffect(rpcOf(method).payloadSchema)(input);

/** Encodes a reply with the kit's schema (a stream method: one element). */
export function encodeSuccess(method: string, value: unknown) {
  const success = rpcOf(method).successSchema;
  const schema = RpcSchema.isStreamSchema(success) ? success.success : success;
  return Schema.encodeUnknownEffect(schema)(value);
}

/** Encodes a failure the method declares; anything else is not shown to clients. */
export const encodeFailure = (method: string, error: unknown) =>
  Schema.encodeUnknownEffect(rpcOf(method).errorSchema)(error).pipe(Effect.option);

export const isStreamMethod = (method: string) =>
  RpcSchema.isStreamSchema(rpcOf(method).successSchema);
