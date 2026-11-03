// HOST PORT (t3-ai-providers-kit): resolves GitHub/GitLab/... links mentioned in a prompt so generated thread titles can use the PR/issue title.
// Original: host-reference/apps/server/src/sourceControl/SourceControlProviderRegistry.ts
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

export class SourceControlLinkError extends Schema.TaggedError<SourceControlLinkError>()(
  "SourceControlLinkError",
  { detail: Schema.String },
) {}

export interface SourceControlLinkSubject {
  readonly title: string;
  readonly body: string | null;
}

/** Return undefined synchronously for unsupported URLs, without starting a lookup. */
export type ResolveSourceControlLink = (input: {
  readonly cwd: string;
  readonly url: URL;
}) => Effect.Effect<SourceControlLinkSubject, SourceControlLinkError> | undefined;

export class SourceControlProviderRegistry extends Context.Service<
  SourceControlProviderRegistry,
  { readonly resolveLink: ResolveSourceControlLink }
>()("t3/sourceControl/SourceControlProviderRegistry") {}

export const layerNone = Layer.succeed(SourceControlProviderRegistry, { resolveLink: () => undefined });
