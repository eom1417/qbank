// HOST PORT (t3-ai-providers-kit): host power/battery telemetry used to pause background provider work. Original: host-reference/apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts
import type { DesktopHostTelemetrySnapshot } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";

export class DesktopTelemetryReceiver extends Context.Service<
  DesktopTelemetryReceiver,
  {
    readonly subscribe: Effect.Effect<
      {
        readonly latest: Option.Option<DesktopHostTelemetrySnapshot>;
        readonly changes: Stream.Stream<DesktopHostTelemetrySnapshot>;
      },
      never,
      Scope.Scope
    >;
  }
>()("t3/resourceTelemetry/DesktopTelemetryReceiver") {}

/** No desktop shell: power state stays unknown and background work is never throttled for battery. */
export const layerNone = Layer.succeed(DesktopTelemetryReceiver, {
  subscribe: Effect.succeed({ latest: Option.none(), changes: Stream.empty }),
});
