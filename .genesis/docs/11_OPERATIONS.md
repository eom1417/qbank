# Reliability, delivery and commercial readiness

## Design for operations, not premature infrastructure

- Separate local/test/staging/production configuration and secrets; safe defaults; versioned config schema.
- Define health/readiness checks, timeouts, retries with jitter, idempotency keys, backpressure and resource limits.
- Structured logs with correlation IDs, privacy redaction and bounded retention; actionable metrics and alert thresholds.
- Data migrations: forward/backward compatibility when possible, backups, restore drills and no editing applied migrations.
- Explicit dependency failure behavior and service degradation. Document fallbacks rather than letting them silently bypass security.
- Artifact provenance, signed/pinned dependencies where supported, reproducible builds and release notes.
- Rollback procedure covers application version **and** data/schema compatibility. Test it, not just document it.
- Security incidents: credential revocation, containment, evidence handling and disclosure path.
- Privacy/compliance: jurisdiction, retention, deletion/export, consent and least-privilege service accounts; choose controls appropriate to product domain.

## Launch milestones

**Local engineering readiness**: all configured gates pass, main user journeys tested locally, owner map and no known critical safety issue.

**Staging readiness**: actual provider settings, auth callbacks, secrets, proxy, backups/restore, E2E, rate limits and failure modes verified.

**Production readiness**: controlled release, observability, support/on-call path, external legal/commercial commitments, incident response, backup and rollback rehearsed.

Never mark a stage complete based only on local mocks or static scans. Paid integration is allowed to be deferred while building, but the product must not describe stubbed payment/auth as real.
