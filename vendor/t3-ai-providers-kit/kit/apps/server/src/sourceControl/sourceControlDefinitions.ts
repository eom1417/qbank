// HOST PORT (t3-ai-providers-kit): source-control hosts whose tokens share the settings secret store with provider credentials.
// Original: host-reference/apps/server/src/sourceControl/sourceControlDefinitions.ts (built from packages/source-control-*).
import type { SourceControlProviderKind } from "@t3tools/contracts";
import type * as Schema from "effect/Schema";

export interface SourceControlDefinition {
  readonly kind: SourceControlProviderKind;
  readonly settings?: { readonly fields: Readonly<Record<string, Schema.Top>> } & Schema.Decoder<object>;
}

/** Empty when the host has no source-control integration. */
export const sourceControlDefinitions: {
  readonly definitions: ReadonlyArray<SourceControlDefinition>;
} = { definitions: [] };
