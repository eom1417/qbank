/** The part of a provider snapshot the update policy reads (the kit's `ServerProvider`). */
export interface UpdateCandidate {
  readonly instanceId: string;
  readonly driver: string;
  readonly enabled: boolean;
  readonly installed: boolean;
  readonly updateRequiredModels?: ReadonlyArray<unknown>;
  readonly versionAdvisory?: {
    readonly status: string;
    readonly canUpdate: boolean;
    readonly latestVersion?: string | null;
  };
}

const isStale = (provider: UpdateCandidate) =>
  provider.versionAdvisory?.status === 'behind_latest' ||
  (provider.updateRequiredModels?.length ?? 0) > 0;

/**
 * The CLIs to update now: each enabled, installed provider whose CLI the kit can update and that
 * is behind its latest release or too old for one of its models. One per driver, because every
 * instance of a driver runs the same CLI binary. `key` names the release, so a caller tries each
 * release once instead of retrying a failing update on every change.
 */
export function updatesDue(
  providers: ReadonlyArray<UpdateCandidate>,
): Array<{ driver: string; instanceId: string; key: string }> {
  const due = new Map<string, UpdateCandidate>();
  for (const provider of providers) {
    if (!provider.enabled || !provider.installed || due.has(provider.driver)) continue;
    if (provider.versionAdvisory?.canUpdate === true && isStale(provider))
      due.set(provider.driver, provider);
  }
  return [...due.values()].map(({ driver, instanceId, versionAdvisory }) => ({
    driver,
    instanceId,
    key: `${driver}@${versionAdvisory?.latestVersion ?? 'unknown'}`,
  }));
}
