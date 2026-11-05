import { z } from 'zod';
import { KitMethod } from '../../../../contracts/providers.js';

/**
 * What an account may do with its AI (DEC-35). `signIn`: link its own providers (sign in, keys,
 * turn on and off, test a model). `operator`: change the machine itself (install and update the
 * provider tools, which every account's host runs). Local: both. Accounts with a host each:
 * sign-in only. Accounts sharing one host (the roll-back switch): neither.
 */
export interface ProviderAccess {
  signIn: boolean;
  operator: boolean;
}

export function accessOf(mode: 'local' | 'accounts', perAccount: boolean): ProviderAccess {
  return { signIn: mode === 'local' || perAccount, operator: mode === 'local' };
}

/**
 * The kit methods an account may call on its own host without being the operator: every install
 * and update stays with the operator, and so do the ChatGPT profile imports (they read a
 * sign-in found on the machine rather than make one).
 */
const MACHINE_METHODS: ReadonlySet<string> = new Set([
  'server.updateProvider',
  'provider.install.start',
  'provider.install.cancel',
  'provider.install.remove',
  'server.prepareAcpRegistryAgent',
  'server.uninstallAcpRegistryManagedBinary',
  'provider.chatgpt.reconnect-profile',
  'provider.chatgpt.import-profile',
]);

export const TenantMethod = KitMethod.refine((method) => !MACHINE_METHODS.has(method));

/**
 * One instance as an account may write it: its driver, name, on or off, Codex's setup mode, and
 * the driver's own key fields. Never a binary path, a home folder, launch arguments or any other
 * variable: those would run a program of the user's choosing on the server, or point a provider
 * at another account's folder.
 */
const TenantInstance = z
  .object({
    driver: z.string().min(1).max(100),
    enabled: z.boolean().optional(),
    displayName: z.string().max(200).optional(),
    config: z
      .object({ setupMode: z.enum(['existing']) })
      .strict()
      .optional(),
    environment: z
      .array(
        z
          .object({
            name: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
            value: z.string().max(4000),
            sensitive: z.literal(true),
          })
          .strict(),
      )
      .max(10)
      .optional(),
  })
  .strict();

const TenantSettingsWrite = z
  .object({
    patch: z.object({}).strict(),
    providerInstanceMutation: z.discriminatedUnion('operation', [
      z
        .object({
          operation: z.enum(['create', 'upsert']),
          instanceId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
          instance: TenantInstance,
        })
        .strict(),
      z
        .object({
          operation: z.literal('remove'),
          instanceId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
        })
        .strict(),
    ]),
  })
  .strict();

/** The key fields each driver declares (`/drivers` → `environmentFields`). */
export type DriverFields = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * Whether an account (not the operator) may send this input to this method. A settings write
 * must be an instance change of the shape above, and each variable one its driver declares.
 */
export function tenantInputAllowed(method: string, input: unknown, fields: DriverFields): boolean {
  if (method !== 'server.updateSettings') return true;
  const parsed = TenantSettingsWrite.safeParse(input);
  if (!parsed.success) return false;
  const mutation = parsed.data.providerInstanceMutation;
  if (mutation.operation === 'remove') return true;
  const allowed = fields.get(mutation.instance.driver) ?? new Set<string>();
  return (mutation.instance.environment ?? []).every((variable) => allowed.has(variable.name));
}

/** The drivers' key fields as the host lists them. */
export function driverFieldsOf(body: unknown): DriverFields {
  const drivers = (body as { drivers?: unknown } | null)?.drivers;
  const list = Array.isArray(drivers) ? drivers : [];
  return new Map(
    list.flatMap((driver: { driverKind?: unknown; environmentFields?: unknown }) =>
      typeof driver.driverKind === 'string'
        ? [[driver.driverKind, new Set(namesOf(driver.environmentFields))] as const]
        : [],
    ),
  );
}

const namesOf = (fields: unknown) =>
  (Array.isArray(fields) ? fields : []).flatMap((field: { name?: unknown }) =>
    typeof field.name === 'string' ? [field.name] : [],
  );
