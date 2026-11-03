import { providerClients } from '../../../vendor/t3-ai-providers-kit/kit/packages/client-runtime/src/providerClients.ts';
import * as Schema from 'effect/Schema';

/**
 * Each driver's client definition (the kit's providerClients.ts: label, icon, badge, API-key
 * fields), with its settings schema as JSON Schema so QBank's screen renders the same form.
 */
export function listDrivers() {
  return providerClients.definitions.map((definition) => ({
    driverKind: definition.driverKind,
    label: definition.label,
    icon: definition.icon ?? null,
    badgeLabel: definition.badgeLabel ?? null,
    featured: definition.featured !== false,
    hasDefaultInstance: definition.hasDefaultInstance !== false,
    environmentFields: definition.environmentFields ?? [],
    settings: Schema.toJsonSchemaDocument(definition.settingsSchema),
  }));
}
