# Phase 6 — Engineering evidence

**Completion is gated.** Local measurements, real Redis drills, live-model quality/cost comparison, consenting pilot and public publication have separate evidence requirements. See the [result ledger](docs/PHASE6_RESULTS.md).

## Reproduce

Use Node 24 and run `npm ci` in `server` and `client`, then from the root:

```powershell
npm test
npm run lint
npm run build
npm run evidence:phase6
# Requires Docker; owns a uniquely named disposable stack.
node scripts/setupLocal.cjs
npm run test:phase6:containers
```

The local runner ignores `.env`, uses fictional accounts, disposable MongoDB, loopback HTTP and the local queue. It makes no paid-provider calls and cleans up fixtures. It waits for actual 90-second leases; allow about two minutes. Even failure writes `.test-tmp/phase6-evidence.json`. Run on an idle machine after other checks. Reports include runtime/hardware, Git revision, dirty-tree status and a digest of source/scripts/locks.

The fixed closed-loop workload uses five accounts and a small Python resume. At concurrency 1/5/10 it submits 30 assessment jobs and interleaves 30 authenticated resume-list reads, then waits for completion. Cache stays warm across levels. Results include acceptance/failures, API/read p50/p95/p99/max, queue wait, execution, elapsed time and completed jobs/second. Smoke thresholds: zero job failures/rejections and read p95 below 2000 ms. This is not a production SLO, large-file, WAN, open-loop overload, multi-node or provider-throughput benchmark.

## Observability and controls

Manual OpenTelemetry spans join requests, persisted jobs and provider attempts. OTLP HTTP exports traces/metrics; stdout HTTP logs and owned processing logs carry trace IDs. See OpenTelemetry's [signals](https://opentelemetry.io/docs/what-is-opentelemetry/) and [propagation](https://opentelemetry.io/docs/languages/js/propagation/) documentation. Configure a trusted `OTEL_EXPORTER_OTLP_ENDPOINT`, API/worker service names, collector authentication/TLS and retention. Empty endpoint means no telemetry network export; identifiers still work. Logs remain stdout/MongoDB, without an automatic log exporter.

Responses expose W3C context and `X-Trace-Id`; jobs preserve it for independent workers/retries. Baggage is not accepted. Separate PDF/DOCX download traces link through `ProductEvent.processingTraceId`. Other downloads have request/export events. Trace IDs grant no access. Metrics cover request/queue/execution times, outcomes, retries, provider attempts/duration/reservations/skips and cache hit/miss/coalescing. Labels omit account/job IDs. Spans omit raw URLs, bodies, credentials, source text, prompts and responses. Domain records still follow owned retention. Activity exposes account limits, reservations and technical timing.

Defaults: five active jobs/account, five jobs/worker, two network attempts/provider, 30-second cooldown and $1 of reservations/account/UTC day. Settings are validated. Shared atomic admission prevents multi-producer races. Terminal slots are reclaimed; pre-insert crash orphans wait five minutes. Pending jobs count. Duplicate deliveries execute once; independent submissions remain separate requests, with no request-key idempotency claim.

Every physical network attempt, including repairs, reserves integer microdollars before transport: `(serialized UTF-8 bytes + 1024) × input USD/million + output-token cap × output USD/million`, rounded up. The output cap goes on the wire. Ambiguous failures retain reservations. Accounting failure, absent policy/owner, oversized input, budget exhaustion or provider cooldown/capacity blocks transport and permits local fallback. 429/5xx/transport failures open shared cooldowns. Slots release in `finally` or expire. Reservations are not invoices: maintain rates and use vendor-side spending caps independently.

## Measured model policy

External calls require credentials, verified email, account opt-in and `AI_MODEL_POLICY_PATH`. Start with [an empty array](config/model-policy.example.json). Actual entries require `provider`, exact `model`, reviewed `benchmarkId`, `samples`, `qualityScore`, `p95Ms`, `maxInputBytes`, `maxOutputTokens`, `inputUsdPerMillion` and `outputUsdPerMillion`. Fill these from real frozen evaluations and current vendor rates; zero rates are only for genuinely free service. Quality must meet `AI_MIN_QUALITY_SCORE` (default 0.9). Selection orders passing candidates by combined input/output unit rates, then measured p95. Evidence is operator-reviewed, not attested by the app. Mount the same policy file in API/worker containers and use its in-container path.

An empty policy allows deterministic processing only. Legacy direct-provider benchmark scripts now require a scoped, budgeted account invocation under the transport gate; credentials alone no longer enable them. Historical Phase 4 reports cover their named versions. A new live comparison remains pending: freeze dataset/evaluator/source, authorize bounded spending, use identical cases, count all failures/retries/tokens, and review quality before enabling policies.

## Failure and privacy boundaries

The runner kills a real worker, waits for its real lease, interrupts MongoDB during execution, recovers durable jobs and delivers each twelve times to verify one execution. Tests exercise admission/accounting races, real slow-HTTP timeout, repair debits, cooldown and real OTLP transport to a loopback receiver. The container runner exercises Redis outage, producer/worker separation and MongoDB restart. Scripts/CI definitions alone are not passing evidence.

Malicious resume/JD instructions, foreign-owner retrieval and direct mutation fixtures test isolation and deterministic output boundaries. They do not establish live-model attack resistance. Candidate data stays outside trusted chat system instructions; Gemini has a separate system instruction.

Backup tests capture quiesced fictional documents/indexes/local originals in checksum-verified BSON Extended JSON. Restore requires empty targets, verifies before writing, invalidates sessions and replays a restricted erasure ledger before reopening traffic. Tests reject tampering, rotate JWT/payload secrets and verify all owned collections/original bytes are erased. This helper is a bounded maintenance demonstration, not a streaming/transaction-consistent production backup. Use managed snapshots/MongoDB tooling and consistent shared/cloud file backups for production. Preserve the erasure ledger through backup retention; anonymous seven-day receipts cannot reconstruct it. See [operations](docs/RUNBOOK.md) and [decisions](docs/PHASE6_DECISIONS.md).

The [pilot kit](docs/PHASE6_PILOT.md) provides consent, fixed tasks, first-export timing and decision denominators. Recruitment is pending. `PHASE6_DEMO=1` with `client/test/browser-workflows.cjs` records fictional preloaded facts, real review/API/PDF export and deterministic processing. Automated demonstrations are not pilot participants. Public publication and pilot results remain completion gates.
