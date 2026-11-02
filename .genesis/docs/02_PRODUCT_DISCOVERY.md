# Product discovery: before writing a line of application code

Record enough to avoid expensive rewrites, not a 100-page speculative specification.

## First-pass decisions

- Who uses it? User types, trust levels, organizational boundaries, accessibility/languages.
- Which **three core journeys** must work end-to-end? Write concrete success and failure examples.
- What objects exist? What makes each object valid? Which role owns/can see/edit/delete it?
- What data must persist? Who is source of truth? Privacy/retention/export/deletion rules?
- What is the product *not* doing yet? Explicit non-goals and deferred external integrations.
- Expected scale/latency/offline use/availability and service-cost ceiling (assumptions labelled).
- Regulated data, geographic requirements, payment/finance/medical/safety implications.
- Failure modes: duplicate requests, lost connection, partial writes, stale clients, simultaneous edits.

## Minimum artifacts

1. One-page product brief with purpose, personas, success metrics, exclusions.
2. Domain glossary including exact words used by UI, API and tests.
3. Three prioritized journeys with acceptance examples and explicit permission denials.
4. Data and trust-boundary diagram, owner map and key invariants.
5. ADR only for irreversible/high-impact choices (data store, hosting, authentication, payments).
6. First vertical slice, *including* security and test implementation.

## Clarification discipline

Ask only questions that can change the architecture, security model, data lifecycle or business behavior. Make reversible defaults for ordinary detail; clearly flag assumptions. Do not begin costly work on a critical ambiguous authorization or destructive-data policy.

## Avoid speculative buildout

- Do not build unrequested billing, message bus, microservices, plugin system, AI agent swarm or multi-region architecture.
- Use adapters/ports only for genuinely variable external boundaries. Don't pretend external payments/security are working using placeholders.
- Product decisions and external credentials remain owner-controlled. Never use live data in tests.
