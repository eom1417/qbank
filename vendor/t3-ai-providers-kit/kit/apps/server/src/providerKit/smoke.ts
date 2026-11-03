/**
 * Smoke test: boots the standalone kit, prints every provider instance with its status, sign-in
 * state and model count, then enables Cursor through a settings write and waits for the registry
 * to reconcile. Run from kit/apps/server with Node >= 24.10:
 *   KIT_HOME=/tmp/kit-home node src/providerKit/smoke.ts
 */
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

import * as ProviderInstanceRegistry from "../provider/ProviderInstanceRegistry.ts";
import * as ProviderRegistry from "../provider/ProviderRegistry.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as ProviderKit from "./ProviderKitStandalone.ts";

const cursorId = ProviderInstanceId.make("cursor");

const program = Effect.gen(function* () {
  const registry = yield* ProviderRegistry.ProviderRegistry;
  for (const provider of yield* registry.getProviders) {
    yield* Effect.logInfo(
      `${provider.instanceId} driver=${provider.driver} status=${provider.status} auth=${provider.auth.status} models=${provider.models.length}`,
    );
  }

  const settings = yield* ServerSettings.ServerSettingsService;
  const instances = yield* ProviderInstanceRegistry.ProviderInstanceRegistry;
  yield* settings.updateProviderInstance({
    operation: "upsert",
    instanceId: cursorId,
    instance: { driver: ProviderDriverKind.make("cursor"), enabled: true },
  });
  const cursorEnabled = instances.listInstances.pipe(
    Effect.map((all) => all.some((instance) => instance.instanceId === cursorId && instance.enabled)),
  );
  // Reconciliation runs on a forked settings watcher, so poll briefly for it.
  const enabled = yield* cursorEnabled.pipe(
    Effect.repeat({ until: (value) => value, schedule: Schedule.spaced("100 millis") }),
    Effect.timeoutOption("15 seconds"),
  );
  yield* Effect.logInfo(`settings write reconciled: cursor enabled=${enabled._tag === "Some"}`);
});

const baseDir = process.env.KIT_HOME ?? `${process.cwd()}/.kit-home`;

program.pipe(
  Effect.provide(
    ProviderKit.layer({
      cwd: process.cwd(),
      baseDir,
      environmentId: "00000000-0000-4000-8000-000000000001" as never,
    }),
  ),
  NodeRuntime.runMain,
);
