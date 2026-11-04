import { z } from 'zod';

/** Why the user's AI stopped (shown on an import report), or that it is ready. */
export const AiOutcomeStatus = z.enum([
  'unchecked',
  'ready',
  'invalid_key',
  'no_permission',
  'no_quota',
  'rate_limited',
  'unreachable',
  'model_missing',
  'unexpected',
]);
export type AiOutcomeStatus = z.infer<typeof AiOutcomeStatus>;

/**
 * The T3 AI Providers Kit methods the providers screens call, by their wire names (the kit's
 * `WS_METHODS`). Inputs and outputs are the kit's own schemas, checked by ai-host.
 */
const KIT_METHODS = [
  'server.refreshProviders',
  'server.updateSettings',
  'server.updateProvider',
  'provider.auth.start',
  'provider.auth.respond',
  'provider.auth.complete',
  'provider.auth.cancel',
  'provider.auth.logout',
  'provider.chatgpt.reconnect-profile',
  'provider.chatgpt.import-profile',
  'provider.consumeResetCredit',
  'server.getUsageSummary',
  'server.refreshUsageRates',
  'provider.install.start',
  'provider.install.cancel',
  'provider.install.remove',
  'server.searchAcpRegistry',
  'server.prepareAcpRegistryAgent',
  'server.uninstallAcpRegistryManagedBinary',
] as const;

/** Methods whose reply is a live stream of states (a sign-in flow, an install). */
const KIT_STREAMS = ['provider.auth.subscribe', 'provider.install.subscribe'] as const;

export const KitMethod = z.enum(KIT_METHODS);
export const KitStream = z.enum(KIT_STREAMS);
export type KitMethod = z.infer<typeof KitMethod>;
export type KitStream = z.infer<typeof KitStream>;

/** What the providers screens read of one kit instance (the kit's `ServerProvider`). */
export const ProviderView = z.looseObject({
  instanceId: z.string(),
  driver: z.string(),
  displayName: z.string().optional(),
  badgeLabel: z.string().optional(),
  enabled: z.boolean(),
  installed: z.boolean(),
  version: z.string().nullable(),
  status: z.enum(['ready', 'warning', 'error', 'disabled']),
  message: z.string().optional(),
  auth: z.looseObject({
    status: z.enum(['authenticated', 'unauthenticated', 'unknown']),
    label: z.string().optional(),
    email: z.string().optional(),
    canLogout: z.boolean().optional(),
  }),
  setup: z
    .looseObject({
      canAuthenticate: z.boolean(),
      canInstall: z.boolean(),
      documentationUrl: z.string().optional(),
    })
    .optional(),
  models: z.array(
    z.looseObject({ slug: z.string(), name: z.string(), isDefault: z.boolean().optional() }),
  ),
  usageLimits: z
    .looseObject({
      windows: z.array(
        z.looseObject({
          id: z.string(),
          label: z.string(),
          usedPercent: z.number(),
          resetsAt: z.string().optional(),
        }),
      ),
      resetCredits: z.looseObject({ availableCount: z.number() }).optional(),
    })
    .optional(),
  versionAdvisory: z
    .looseObject({
      status: z.string(),
      latestVersion: z.string().nullable(),
      canUpdate: z.boolean(),
    })
    .optional(),
  updateState: z.looseObject({ status: z.string(), message: z.string().nullable() }).optional(),
});
export type ProviderView = z.infer<typeof ProviderView>;

/** A configured instance as settings.json keeps it (secrets redacted by the kit). */
const InstanceConfig = z.looseObject({ driver: z.string(), enabled: z.boolean().optional() });
export type InstanceConfig = z.infer<typeof InstanceConfig>;

export const ProviderStateResponse = z.looseObject({
  providers: z.array(ProviderView),
  settings: z.looseObject({ providerInstances: z.record(z.string(), InstanceConfig).optional() }),
});
export type ProviderStateResponse = z.infer<typeof ProviderStateResponse>;

/** A driver the user can add (the kit's client definition). */
export const DriverView = z.looseObject({
  driverKind: z.string(),
  label: z.string(),
  badgeLabel: z.string().nullable(),
  featured: z.boolean(),
  environmentFields: z.array(
    z.looseObject({
      name: z.string(),
      label: z.string(),
      description: z.string().optional(),
      sensitive: z.boolean().optional(),
    }),
  ),
});
export type DriverView = z.infer<typeof DriverView>;
export const DriverListResponse = z.looseObject({ drivers: z.array(DriverView) });

const AuthInteraction = z.union([
  z.looseObject({
    type: z.literal('browser'),
    id: z.string(),
    url: z.string(),
    acceptsCallback: z.boolean().optional(),
  }),
  z.looseObject({
    type: z.literal('deviceCode'),
    id: z.string(),
    url: z.string(),
    userCode: z.string(),
  }),
  z.looseObject({ type: z.literal('terminal'), id: z.string(), output: z.string() }),
  z.looseObject({
    type: z.literal('credentials'),
    id: z.string(),
    fields: z.array(z.looseObject({ name: z.string(), label: z.string(), secret: z.boolean() })),
  }),
]);

/** One sign-in flow as the kit reports it (`ProviderAuthState`). */
export const AuthStateView = z.looseObject({
  instanceId: z.string(),
  phase: z.enum(['idle', 'starting', 'waiting', 'verifying', 'succeeded', 'failed', 'cancelled']),
  flowId: z.string().nullable(),
  authorizationUrl: z.string().nullable(),
  message: z.string().nullable(),
  methods: z
    .array(
      z.looseObject({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        type: z.string(),
      }),
    )
    .optional(),
  interaction: AuthInteraction.nullable().optional(),
});
export type AuthStateView = z.infer<typeof AuthStateView>;

/** A provider instance of the AI providers kit, such as `codex` (DEC-30). */
export const KitInstanceId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/);
/** One of that instance's models, such as `gpt-5.5`; when omitted, the instance's default. */
export const KitModel = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,199}$/);
/** Which of the user's AI runs a task: the instance and, if chosen, its model. */
export const AiTarget = z
  .object({ instanceId: KitInstanceId, model: KitModel.optional() })
  .strict();
export type AiTarget = z.infer<typeof AiTarget>;

/**
 * Sign-in through a provider's official CLI (ai-host cli-login), for providers the kit can only
 * sign in from a terminal. Credentials stay in the AI host's home and refresh on their own.
 */
const CLI_LOGIN_METHODS = [
  'codex.chatgpt',
  'codex.apiKey',
  'claude.subscription',
  'claude.console',
] as const;
export const CliLoginMethod = z.enum(CLI_LOGIN_METHODS);
export type CliLoginMethod = z.infer<typeof CliLoginMethod>;
export const CliProvider = z.enum(['codex', 'claude']);
export type CliProvider = z.infer<typeof CliProvider>;

/** A pasted code or key: printable, one line, bounded. */
const PastedLine = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .regex(/^[\x21-\x7e]+$/);

export const CliLoginStartRequest = z
  .object({ method: CliLoginMethod, secret: PastedLine.optional() })
  .strict();
export const CliLoginCodeRequest = z.object({ code: PastedLine }).strict();
export const CliLogoutRequest = z.object({ provider: CliProvider }).strict();

export const CliLoginView = z.object({
  id: z.string(),
  method: CliLoginMethod,
  provider: CliProvider,
  status: z.enum(['starting', 'waiting', 'verifying', 'done', 'failed', 'expired']),
  link: z.string().nullable(),
  userCode: z.string().nullable(),
  needsCode: z.boolean(),
  message: z.string().nullable(),
});
export type CliLoginView = z.infer<typeof CliLoginView>;
