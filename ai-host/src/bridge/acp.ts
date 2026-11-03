import * as AcpRegistrySupport from '@t3tools/provider-acp-registry/server/AcpRegistrySupport';
import * as Effect from 'effect/Effect';

type Catalog = AcpRegistrySupport.AcpRegistryCatalog['Service'];

/** The ACP agent registry: find agents, prepare their binaries, remove them (§6). */
export const acpHandlers = {
  'server.searchAcpRegistry': Effect.fnUntraced(function* (
    input: Parameters<Catalog['search']>[0],
  ) {
    const catalog = yield* AcpRegistrySupport.AcpRegistryCatalog;
    return yield* catalog
      .search(input)
      .pipe(Effect.mapError(AcpRegistrySupport.toAcpRegistryOperationError));
  }),
  'server.prepareAcpRegistryAgent': Effect.fnUntraced(function* (
    input: Parameters<Catalog['prepare']>[0],
  ) {
    const catalog = yield* AcpRegistrySupport.AcpRegistryCatalog;
    return yield* catalog
      .prepare(input)
      .pipe(Effect.mapError(AcpRegistrySupport.toAcpRegistryOperationError));
  }),
  'server.uninstallAcpRegistryManagedBinary': Effect.fnUntraced(function* (
    input: Parameters<Catalog['uninstallManagedBinary']>[0],
  ) {
    const catalog = yield* AcpRegistrySupport.AcpRegistryCatalog;
    return yield* catalog
      .uninstallManagedBinary(input)
      .pipe(Effect.mapError(AcpRegistrySupport.toAcpRegistryOperationError));
  }),
};
