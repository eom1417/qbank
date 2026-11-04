import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { networkInterfaces } from 'node:os';

/** The first private IPv4 address of this computer, for phones on the same Wi-Fi. */
function lanAddress(): string | null {
  const addresses = Object.values(networkInterfaces()).flat();
  const found = addresses.find((a) => a && a.family === 'IPv4' && !a.internal);
  return found?.address ?? null;
}

/**
 * Where a phone on the same network opens this QBank: only when the server listens on every
 * interface (`npm run qbank -- --lan`); a server on loopback is unreachable from another device.
 */
export function lanOrigin(server: Server): string | null {
  const address = server.address() as AddressInfo | null;
  if (!address || !['0.0.0.0', '::'].includes(address.address)) return null;
  const ip = lanAddress();
  return ip ? `http://${ip}:${address.port}` : null;
}
