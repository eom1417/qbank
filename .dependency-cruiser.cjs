/** Architecture gate: dependency direction and capability boundaries (BLUEPRINT.md §3). */
const CAP = '^src/server/capabilities/([^/]+)/';
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'domain-is-pure',
      severity: 'error',
      from: { path: '(^|/)domain/' },
      to: { path: '(^|/)(adapters|http|use-cases|ui)/' },
    },
    {
      name: 'adapters-not-http',
      severity: 'error',
      from: { path: '(^|/)adapters/' },
      to: { path: '(^|/)http/' },
    },
    {
      name: 'capability-internals-are-private',
      comment: 'Another capability is reached only through its index.ts.',
      severity: 'error',
      from: { path: CAP },
      to: { path: CAP + '.+/', pathNot: ['^src/server/capabilities/$1/', CAP + 'index\\.ts$'] },
    },
    {
      name: 'channels-apart-from-study',
      comment: 'DEC-36: a publishing channel never reads or writes study, nor study a channel.',
      severity: 'error',
      from: { path: '^src/(server|web)/capabilities/(channels|study)/' },
      to: { path: '^src/(server|web)/capabilities/(channels|study)/', pathNot: '^src/$1/capabilities/$2/' },
    },
    {
      name: 'platform-owns-no-business',
      severity: 'error',
      from: { path: '^src/(server|web)/platform/' },
      to: { path: '^src/(server|web)/capabilities/' },
    },
    {
      name: 'design-system-owns-no-business',
      severity: 'error',
      from: { path: '^src/web/design-system/' },
      to: { path: '^src/web/(capabilities|app)/' },
    },
    { name: 'web-not-server', severity: 'error', from: { path: '^src/web/' }, to: { path: '^src/server/' } },
    { name: 'server-not-web', severity: 'error', from: { path: '^src/server/' }, to: { path: '^src/web/' } },
    {
      name: 'contracts-are-leaves',
      severity: 'error',
      from: { path: '^src/contracts/' },
      to: { path: '^src/(server|web)/' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(dist|node_modules)/' },
  },
};
