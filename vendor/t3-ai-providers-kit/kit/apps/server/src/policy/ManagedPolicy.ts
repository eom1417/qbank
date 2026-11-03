// HOST PORT (t3-ai-providers-kit): admin policy (which providers are allowed, locked settings). Original: host-reference/apps/server/src/policy/ManagedPolicy.ts
// `managedProviders.ts` and `managedSettings.ts` are real kit files; this port only decides which document applies.
import type { ManagedPolicyDocument, ManagedPolicySummary } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

import { unmanagedProviders, type ManagedProviders } from "./managedProviders.ts";
import { unmanagedSettings, type ManagedSettings } from "./managedSettings.ts";

export class ManagedPolicy extends Context.Service<
  ManagedPolicy,
  {
    readonly path: string;
    readonly document: ManagedPolicyDocument | undefined;
    readonly settings: ManagedSettings;
    readonly providers: ManagedProviders;
    readonly summary: ManagedPolicySummary | undefined;
  }
>()("t3/policy/ManagedPolicy") {}

/** No admin policy: every provider allowed, nothing locked. */
export const layerUnmanaged = Layer.succeed(ManagedPolicy, {
  path: "",
  document: undefined,
  settings: unmanagedSettings,
  providers: unmanagedProviders,
  summary: undefined,
});
