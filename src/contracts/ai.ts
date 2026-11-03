import { z } from 'zod';

/**
 * The API a provider speaks. The user brings their own key and model (BYOK, DEC-17/DEC-28):
 * `anthropic` = the Claude Messages API; `openai_compatible` = OpenAI and every service or
 * server that offers the same API (DeepSeek, Gemini, OpenRouter, Mistral, Groq, xAI, …).
 */
export const ApiProviderKind = z.enum(['openai_compatible', 'anthropic']);
export type ApiProviderKind = z.infer<typeof ApiProviderKind>;

/**
 * Every kind of connection: an API key for one of the APIs above, or a subscription account
 * (Claude Pro/Max, ChatGPT Plus/Pro via Codex) signed in through the provider's official CLI.
 */
export const ProviderKind = z.enum([...ApiProviderKind.options, 'claude_account', 'codex_account']);
export type ProviderKind = z.infer<typeof ProviderKind>;

/** The subscription accounts a user can sign in with. */
export const AccountProvider = z.enum(['claude', 'codex']);
export type AccountProvider = z.infer<typeof AccountProvider>;

export interface ProviderPreset {
  id: string;
  label: string;
  kind: ApiProviderKind;
  /** Null for `custom`: the user types the address of any compatible API. */
  baseUrl: string | null;
  /** Where the user creates a key. */
  keysUrl: string | null;
}

/** One-click presets in the connection form; `custom` covers any other compatible API. */
export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai_compatible',
    baseUrl: 'https://api.openai.com/v1',
    keysUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    keysUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai_compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    keysUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    kind: 'openai_compatible',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keysUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai_compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    keysUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    kind: 'openai_compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    keysUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'openai_compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    keysUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    kind: 'openai_compatible',
    baseUrl: 'https://api.x.ai/v1',
    keysUrl: 'https://console.x.ai',
  },
  { id: 'custom', label: 'Custom', kind: 'openai_compatible', baseUrl: null, keysUrl: null },
];

/** What the last readiness check found (FR-08-011). `unchecked` until the first check. */
export const ReadinessStatus = z.enum([
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
export type ReadinessStatus = z.infer<typeof ReadinessStatus>;

const Label = z.string().trim().min(1).max(80);
const Model = z.string().trim().min(1).max(200);
const BaseUrl = z.url({ protocol: /^https?$/ }).max(500);
const ApiKey = z.string().trim().min(8).max(500);
/** Price in US dollars per million tokens, as the user's provider lists it; null = unknown. */
const Price = z.number().min(0).max(1000).nullable();

const Connection = {
  kind: ApiProviderKind,
  baseUrl: BaseUrl,
  /** Optional only for self-hosted compatible servers that take no key. */
  apiKey: ApiKey.optional(),
};

export const CreateProviderRequest = z
  .object({
    ...Connection,
    label: Label,
    model: Model,
    inputPrice: Price.default(null),
    outputPrice: Price.default(null),
    /** Content leaves this server for the chosen provider (FR-20-003): must be acknowledged. */
    acknowledgeDisclosure: z.literal(true),
  })
  .strict();
export type CreateProviderRequest = z.infer<typeof CreateProviderRequest>;

/** Partial change; `apiKey: null` removes the stored key. An empty body is rejected. */
export const UpdateProviderRequest = z
  .object({
    label: Label,
    model: Model,
    baseUrl: BaseUrl,
    apiKey: ApiKey.nullable(),
    inputPrice: Price,
    outputPrice: Price,
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'empty' });
export type UpdateProviderRequest = z.infer<typeof UpdateProviderRequest>;

const Readiness = z
  .object({ status: ReadinessStatus, checkedAt: z.iso.datetime().nullable() })
  .strict();

export const ProviderResponse = z
  .object({
    id: z.uuid(),
    kind: ProviderKind,
    label: z.string(),
    /** Null for subscription accounts, which have no API address. */
    baseUrl: z.string().nullable(),
    /** The signed-in subscription account; null for API-key connections. */
    account: z
      .object({ email: z.string().nullable(), plan: z.string().nullable() })
      .strict()
      .nullable(),
    model: z.string(),
    /** Only the last characters, e.g. "••••3f9a"; the full key is never returned (FR-08-009). */
    keyHint: z.string().nullable(),
    isDefault: z.boolean(),
    inputPrice: z.number().nullable(),
    outputPrice: z.number().nullable(),
    readiness: Readiness,
  })
  .strict();
export type ProviderResponse = z.infer<typeof ProviderResponse>;

export const ProviderListResponse = z
  .object({
    providers: z.array(ProviderResponse),
  })
  .strict();
export type ProviderListResponse = z.infer<typeof ProviderListResponse>;

export const CheckResponse = z
  .object({
    readiness: Readiness,
    /** True when a known hard failure was returned without calling the provider again. */
    fromCache: z.boolean(),
  })
  .strict();
export type CheckResponse = z.infer<typeof CheckResponse>;

/** Lists the models a key can use, before the connection is saved (the key is not stored). */
export const ListModelsRequest = z.object(Connection).strict();
export type ListModelsRequest = z.infer<typeof ListModelsRequest>;

export const ListModelsResponse = z
  .object({ status: ReadinessStatus, models: z.array(z.string()) })
  .strict();
export type ListModelsResponse = z.infer<typeof ListModelsResponse>;

/** The question the model read in a trial run, after validation as untrusted output. */
export const TrialResponse = z
  .object({
    outcome: z.enum(['ok', 'invalid_output', 'not_ready']),
    readiness: Readiness,
    question: z
      .object({ stem: z.string(), options: z.array(z.string()), answer: z.string().nullable() })
      .strict()
      .nullable(),
  })
  .strict();
export type TrialResponse = z.infer<typeof TrialResponse>;

/** DEC-18 (suggested default, provisional): a limit the user sets, with honest estimates. */
export const AiSettings = z
  .object({
    /** Ask before a task whose estimated cost exceeds this; null = no money limit. */
    costLimitUsd: z.number().min(0).max(10_000).nullable(),
    /** Ask before any AI task on a file with more pages than this. */
    approvalPages: z.number().int().min(1).max(5000),
  })
  .strict();
export type AiSettings = z.infer<typeof AiSettings>;

export const UpdateAiSettingsRequest = AiSettings.partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'empty' });
export type UpdateAiSettingsRequest = z.infer<typeof UpdateAiSettingsRequest>;

export const EstimateRequest = z
  .object({
    pages: z.number().int().min(1).max(5000),
    imagePages: z.number().int().min(0).max(5000).default(0),
  })
  .strict()
  .refine((value) => value.imagePages <= value.pages, { path: ['imagePages'], message: 'too_big' });
export type EstimateRequest = z.infer<typeof EstimateRequest>;

export const ApprovalReason = z.enum(['over_page_limit', 'over_cost_limit', 'cost_unknown']);
export type ApprovalReason = z.infer<typeof ApprovalReason>;

export const EstimateResponse = z
  .object({
    /** The default provider the next AI task would use; null = no provider (FR-08-013). */
    provider: z.object({ id: z.uuid(), label: z.string(), kind: ProviderKind }).strict().nullable(),
    inputTokens: z.number().int(),
    outputTokens: z.number().int(),
    /** Null when the price is unknown: no invented bill (FR-08-012). */
    costUsd: z.number().nullable(),
    needsApproval: z.boolean(),
    reasons: z.array(ApprovalReason),
  })
  .strict();
export type EstimateResponse = z.infer<typeof EstimateResponse>;

/** Starts signing in with a subscription account; the content disclosure must be accepted. */
export const StartAccountLoginRequest = z
  .object({ provider: AccountProvider, acknowledgeDisclosure: z.literal(true) })
  .strict();
export type StartAccountLoginRequest = z.infer<typeof StartAccountLoginRequest>;

/** The code Claude shows after the user approves the sign-in in their browser. */
export const SubmitLoginCodeRequest = z
  .object({ code: z.string().trim().min(4).max(500) })
  .strict();
export type SubmitLoginCodeRequest = z.infer<typeof SubmitLoginCodeRequest>;

export const AccountLoginStatus = z.enum([
  'awaiting_code',
  'waiting',
  'completed',
  'failed',
  'cancelled',
  'expired',
]);
export type AccountLoginStatus = z.infer<typeof AccountLoginStatus>;

/**
 * A sign-in in progress. Claude: open `authUrl`, approve, paste the code shown. Codex: open
 * `authUrl` and enter `deviceCode`. On `completed`, `providerId` is the new connection.
 */
export const AccountLoginResponse = z
  .object({
    id: z.uuid(),
    provider: AccountProvider,
    status: AccountLoginStatus,
    authUrl: z.string().nullable(),
    deviceCode: z.string().nullable(),
    error: z.string().nullable(),
    providerId: z.uuid().nullable(),
  })
  .strict();
export type AccountLoginResponse = z.infer<typeof AccountLoginResponse>;
