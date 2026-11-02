# Security and privacy by default

## Threat model at inception

Document assets, adversaries, trusted/untrusted inputs, boundaries, storage, providers, user roles and abuse cases. Use risk-driven OWASP ASVS for web/APIs, OWASP MASVS for mobile and appropriate language/product standards. Not every project needs every control; **no risk can be silently declared safe because a scanner is green**.

## Mandatory technical boundaries

- Authenticate and verify on the server/trusted boundary. Default deny; least privilege; per-object and per-property authorization; separate authn/authz; re-check privileged operations.
- Explicit tenant/user scoping in every read, update, delete, export, background task and file link. Test cross-user denial.
- Session expiry, revocation, CSRF appropriate to cookie auth, secure CORS, safe redirects, replay/idempotency and step-up for dangerous actions.
- Validate input shape, semantics, encoding and size; bound file sizes/types, parse content safely, protect against injection, SSRF, path traversal and resource exhaustion.
- Secrets in managers/environment, never source or logs. Redact PII; do not include secrets in prompts, scanner output or PRs.
- Dependency/lockfile integrity and supply-chain risk; version pinning, licenses and reproducible builds.
- Encrypt in transit and at rest where applicable; sensitive local storage appropriate to platform; data retention/delete/export and backup restore verified.
- Separate environments and service roles; no test bypass in production; strong default config, timeouts and rate limiting considering multi-instance deployments.
- Security event logs have actionable identifiers but no passwords/tokens. Incident response, revocation and rollback paths documented.
- For AI: prompt injection, tool scopes, untrusted retrieval, cost/rate limits and sensitive data flowing to model providers.

## Tests and scanning

- Negative/positive access tests at real request/service boundaries; not only mocked guards.
- Local static security lint, credentials scan, dependency advisories and relevant hardening tests.
- Review warnings for exploitability; **never bulk ignore scanner results just to pass**. Suppression of genuinely inapplicable external advisories requires an exact documented advisory ID, vulnerable feature evidence and regression guard, not an exception to code quality constraints.
- Do not run live exploitation tests, exfiltrate data or rotate production secrets without authorization.

## Release security gate

Document unresolved risks, owner decisions, live environment configuration, secrets/proxy/storage settings and operational validation. Local test pass != external configuration verified != full security certification.

References: https://asvs.owasp.org/ and https://mas.owasp.org/.
