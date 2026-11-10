import { describe, expect, it } from 'vitest';
import type { Locale } from '../../../src/contracts/identity.js';
import { ar } from '../../../src/web/platform/i18n/catalog-ar.js';
import { en, type MessageKey } from '../../../src/web/platform/i18n/catalog-en.js';
import { legalSections } from '../../../src/web/platform/i18n/legal-content.js';
import { modeKey, SERVER_SUFFIX } from '../../../src/web/platform/i18n/mode-keys.js';

/**
 * Honest texts per mode (M31, B3). A server user must never read a claim that is only true on a
 * local install. Every new text that says "on your device" without a `.server` variant fails here.
 */
const LOCAL_CLAIMS = [
  'on your device',
  'on this device',
  'your own computer',
  'your computer',
  'on this computer',
  'this machine',
  'no server',
  'data folder',
  'no public sharing',
  'never leaves your',
  'على جهازك',
  'هذا الجهاز',
  'جهازك أنت',
  'لا خادم',
  'بلا خادم',
  'مجلد بيانات',
  'مشاركة عامة',
  'لا يغادر جهازك',
  'الجهاز الذي يشغّل',
];

/** Texts no server user can reach, each with the screen that keeps it local. */
const LOCAL_ONLY: readonly string[] = [
  'local.', // pairing and "your other devices": PairScreen and DevicesCard, local mode only
  'backup.', // BackupCard renders only in local mode (M17.2)
  'error.pairing_required', // pairing exists only on a local install (DEC-31)
  'providers.codex.', // CodexSetupChoice: the machine's operator, which is local mode only
];

const CATALOGS: Record<Locale, Record<MessageKey, string>> = { ar, en };
const KEYS = Object.keys(en) as MessageKey[];
const isServerVariant = (key: string) => key.endsWith(SERVER_SUFFIX);
const isLocalOnly = (key: string) => LOCAL_ONLY.some((prefix) => key.startsWith(prefix));

/** Every text a server user can see in one language: the `.server` variant where one exists. */
function serverTexts(locale: Locale): { where: string; text: string }[] {
  const catalog = CATALOGS[locale];
  const texts = KEYS.filter((key) => !isServerVariant(key) && !isLocalOnly(key)).map((key) => ({
    where: `${locale}:${key}`,
    text: catalog[modeKey(key, 'accounts')],
  }));
  const legal = (['terms', 'privacy'] as const).flatMap((page) =>
    legalSections(locale, page, 'accounts').map((section) => ({
      where: `${locale}:legal.${page}.${section.heading}`,
      text: `${section.heading} ${section.body}`,
    })),
  );
  return [...texts, ...legal];
}

const claimsIn = (text: string) =>
  LOCAL_CLAIMS.filter((claim) => text.toLowerCase().includes(claim.toLowerCase()));

describe('server copy (M31, B3)', () => {
  it.each(['ar', 'en'] as const)('shows a %s server user no local-only claim', (locale) => {
    const found = serverTexts(locale)
      .map(({ where, text }) => ({ where, claims: claimsIn(text) }))
      .filter(({ claims }) => claims.length > 0);
    expect(found).toEqual([]);
  });

  it('reads the server variant on a server, and the base text locally or before the mode is known', () => {
    expect(modeKey('help.privacy.body', 'accounts')).toBe('help.privacy.body.server');
    expect(modeKey('help.privacy.body', 'local')).toBe('help.privacy.body');
    expect(modeKey('help.privacy.body', null)).toBe('help.privacy.body');
    expect(modeKey('help.due.body', 'accounts')).toBe('help.due.body');
  });

  it('gives every server variant a base text, and names the operator only on a server', () => {
    const bases = KEYS.filter(isServerVariant).map((key) => key.slice(0, -SERVER_SUFFIX.length));
    expect(bases.length).toBeGreaterThan(0);
    for (const base of bases) expect(KEYS).toContain(base);
    for (const locale of ['ar', 'en'] as const) {
      const local = bases.map((key) => CATALOGS[locale][key as MessageKey]);
      const legal = (['terms', 'privacy'] as const).flatMap((page) =>
        legalSections(locale, page, 'local').map((s) => s.body),
      );
      expect([...local, ...legal].filter((text) => text.includes('{operator}'))).toEqual([]);
    }
  });

  it('keeps the local texts local: the privacy answer still says where a local install keeps data', () => {
    expect(en['help.privacy.body']).toContain('your own computer');
    expect(claimsIn(en['help.privacy.body.server'])).toEqual([]);
  });
});

describe('day-one trust texts (M32)', () => {
  it('shows final legal pages in every mode: no draft wording (M32)', () => {
    const modes = ['local', 'accounts', null] as const;
    const texts = (['ar', 'en'] as const).flatMap((locale) =>
      modes.flatMap((mode) =>
        (['terms', 'privacy'] as const).flatMap((page) =>
          legalSections(locale, page, mode).map((s) => `${s.heading} ${s.body}`),
        ),
      ),
    );
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.filter((text) => /draft|مسودة|المراجعة القانونية/i.test(text))).toEqual([]);
    expect(Object.keys(en).filter((key) => key.startsWith('legal.draft'))).toEqual([]);
  });

  it('does not tell a server user to run backups: the server makes them (M32)', () => {
    expect(modeKey('providers.withoutAi', 'accounts')).toBe('providers.withoutAi.server');
    expect(en['providers.withoutAi']).toContain('backups');
    expect(en['providers.withoutAi.server']).not.toMatch(/backup/i);
    expect(ar['providers.withoutAi.server']).not.toContain('النسخ الاحتياطي');
  });
});
