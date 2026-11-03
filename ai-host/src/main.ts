import * as Effect from 'effect/Effect';

import { makeProviderInstallation } from './bridge/install.ts';
import { streamMethods, unaryMethods } from './bridge/methods.ts';
import { readConfig } from './config.ts';
import { startServer } from './http/server.ts';
import { makeKitRuntime, startSettingsWatcher } from './runtime.ts';

/**
 * QBank's AI host: boots the vendored T3 AI Providers Kit with its standalone host ports and
 * serves its provider methods to QBank's server on a loopback port.
 */
const config = readConfig(process.env);
const runtime = makeKitRuntime(config);
await runtime.runPromise(startSettingsWatcher);
const installation = await runtime.runPromise(makeProviderInstallation());
const server = startServer(
  runtime,
  { unary: unaryMethods(installation), streams: streamMethods(installation) },
  config,
);
await runtime.runPromise(Effect.logInfo(`ai-host listening on 127.0.0.1:${config.port}`));

const stop = () => {
  server.close();
  void runtime.dispose().finally(() => process.exit(0));
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
