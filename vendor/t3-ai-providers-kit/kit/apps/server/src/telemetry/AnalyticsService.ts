// HOST PORT (t3-ai-providers-kit): product analytics. Optional for Codex sign-in (read with Effect.serviceOption), required by ProviderUsageAnalytics.
// Original: host-reference/apps/server/src/telemetry/AnalyticsService.ts
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import type { TelemetryOwner } from "./Identify.ts";

export class AnalyticsService extends Context.Service<
  AnalyticsService,
  {
    readonly record: (
      event: string,
      properties?: Readonly<Record<string, unknown>>,
    ) => Effect.Effect<void>;
    readonly flush: Effect.Effect<void>;
    readonly recordOwners: (
      owners: ReadonlyArray<TelemetryOwner>,
      observedBy: "server" | "client",
    ) => Effect.Effect<void>;
  }
>()("t3/telemetry/AnalyticsService") {}

export const layerNoop = Layer.succeed(AnalyticsService, {
  record: Effect.fn("AnalyticsService.record")(function* () {}),
  flush: Effect.void,
  recordOwners: Effect.fn("AnalyticsService.recordOwners")(function* () {}),
});
