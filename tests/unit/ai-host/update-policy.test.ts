import { describe, expect, it } from 'vitest';

import { updatesDue, type UpdateCandidate } from '../../../ai-host/src/bridge/update-policy.js';

const claude = (over: Partial<UpdateCandidate> = {}): UpdateCandidate => ({
  instanceId: 'claudeAgent-1',
  driver: 'claudeAgent',
  enabled: true,
  installed: true,
  versionAdvisory: { status: 'current', canUpdate: true },
  ...over,
});

describe('updatesDue', () => {
  it('updates a CLI that is behind its latest release', () => {
    const advisory = { status: 'behind_latest', canUpdate: true, latestVersion: '2.1.318' };
    expect(updatesDue([claude({ versionAdvisory: advisory })])).toEqual([
      { driver: 'claudeAgent', instanceId: 'claudeAgent-1', key: 'claudeAgent@2.1.318' },
    ]);
  });

  it('updates a CLI too old for one of its models', () => {
    const old = claude({ updateRequiredModels: [{ slug: 'claude-haiku-5-5' }] });
    expect(updatesDue([old])).toHaveLength(1);
  });

  it('updates each driver once, whatever its number of instances', () => {
    const behind = { versionAdvisory: { status: 'behind_latest', canUpdate: true } };
    const two = [claude(behind), claude({ ...behind, instanceId: 'claudeAgent-2' })];
    expect(updatesDue(two).map((due) => due.instanceId)).toEqual(['claudeAgent-1']);
  });

  it('leaves current, disabled, missing or non-updatable CLIs alone', () => {
    const behind = { status: 'behind_latest', canUpdate: true };
    expect(
      updatesDue([
        claude(),
        claude({ enabled: false, versionAdvisory: behind }),
        claude({ installed: false, versionAdvisory: behind }),
        claude({ versionAdvisory: { status: 'behind_latest', canUpdate: false } }),
        { instanceId: 'claudeAgent-3', driver: 'claudeAgent', enabled: true, installed: true },
      ]),
    ).toEqual([]);
  });
});
