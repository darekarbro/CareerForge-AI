# Operational decisions

| Decision | Reason | Tradeoff / limit |
|---|---|---|
| MongoDB remains the job authority | Atomic claims and leases tolerate duplicate Redis deliveries | Recovery requires the database; an outage returns unavailable |
| Majority and journaled write acknowledgement | Accepted jobs and budget reservations must survive abrupt database stops | More write latency; primary failover still requires a correctly configured replica set |
| Atomic per-account admission document | Multiple API processes share a single job limit without a transaction requirement | A process death between reservation and insert can hold a slot for five minutes; pending jobs continue to consume capacity |
| Admission reservations have timestamps | An old failure cannot prune a newly reserved retry | Orphan reclamation is intentionally conservative |
| Reserve conservative cost before every physical provider request | Repair attempts and uncertain failures cannot silently exceed the configured reservation ledger | No refunds; USD rates must be maintained; this is not an invoice or a vendor-enforced hard cap |
| Only measured, priced model policies can send data externally | Model choice has an explicit evidence and quality gate | Empty policy means deterministic fallback; credentials and account consent alone do not enable paid calls |
| Scoped test-only calibration capability | New models can be measured without inventing a passing production policy | Requires disposable verified/consenting account, bounded attempts and the same reservation/concurrency controls; never accepted from HTTP input |
| Shared provider slots and cooldown | Workers share concurrency and avoid retry storms | Fast fallback can reduce remote response availability during transient failures |
| Manual OpenTelemetry instrumentation | Stable bounded attributes, trace propagation across queue boundaries, no automatic prompt/header capture | MongoDB and Redis internals are not automatically traced; collector/export configuration remains an operator responsibility |
| Separate public evidence and private pilot data | Reproduction can use fictional inputs | Automated accounts do not establish real-user usability |
| Restore into an empty isolated target | Avoid accidental merge/overwrite and verify checksums before writes | Logical snapshots require maintenance/quiescence; managed database snapshots remain the production backup recommendation |

Provider selection filters configured policies by minimum quality, then orders by combined input/output unit prices and p95 latency. The benchmark reference, sample count and quality score are operator-reviewed inputs, not independently attested by the app. A single vendor/model instance is configured per provider. A passing policy does not establish universal accuracy or prevent every prompt injection. Server-side ownership and output validation remain necessary.
