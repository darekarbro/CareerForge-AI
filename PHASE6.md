# Phase 6 — Engineering evidence

**The consenting pilot is still pending.** Local measurements, real Redis/database container drills, and a bounded live-model comparison have passing evidence. The engineering package is published in [draft PR #13](https://github.com/darekarbro/CareerForge-AI/pull/13). See the [result ledger](docs/PHASE6_RESULTS.md).

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

An empty policy allows deterministic processing only. The [live comparison](docs/PHASE6_LIVE_MODELS.md) measured both Groq GPT-OSS models against the same 16 fictional fixtures each. Both passed the fixture quality gate; 20B was selected by the lower unit rates. The [measured prototype policy](config/model-policy.measured.json) keeps requests within the observed input envelope and does not enable external traffic automatically. Historical Phase 4 reports remain scoped to their named versions.

Reproduce live calibration with `node server/scripts/phase6LiveModels.cjs --live` using the private Groq key in server/.env. It authorizes at most 40 attempts and $0.20 in reservations, creates a disposable verified/consenting account, preserves provider concurrency/cooldown/accounting, and never fabricates a production quality approval to bootstrap measurement. The calibration capability works only inside an isolated test process and expires when its scope exits. A completed single-attempt report can be reused under matching source/fixture hashes with `--reuse=<path inside .test-tmp>`; reservations are reconstructed offline and carried forward. This avoids rebilling successful cases after a reporting failure.

## Failure and privacy boundaries

The runner kills a real worker, waits for its real lease, interrupts MongoDB during execution, recovers durable jobs and delivers each twelve times to verify one execution. Tests exercise admission/accounting races, real slow-HTTP timeout, repair debits, cooldown and real OTLP transport to a loopback receiver. The container runner exercises Redis outage, producer/worker separation and MongoDB restart. Scripts/CI definitions alone are not passing evidence.

Malicious resume/JD instructions, foreign-owner retrieval and direct mutation fixtures test isolation and deterministic output boundaries. They do not establish live-model attack resistance. Candidate data stays outside trusted chat system instructions; Gemini has a separate system instruction.

Backup tests capture quiesced fictional documents/indexes/local originals in checksum-verified BSON Extended JSON. Restore requires empty targets, verifies before writing, invalidates sessions and replays a restricted erasure ledger before reopening traffic. Tests reject tampering, rotate JWT/payload secrets and verify all owned collections/original bytes are erased. This helper is a bounded maintenance demonstration, not a streaming/transaction-consistent production backup. Use managed snapshots/MongoDB tooling and consistent shared/cloud file backups for production. Preserve the erasure ledger through backup retention; anonymous seven-day receipts cannot reconstruct it. See [operations](docs/RUNBOOK.md) and [decisions](docs/PHASE6_DECISIONS.md).

The [pilot kit](docs/PHASE6_PILOT.md) provides consent, fixed tasks, first-export timing and decision denominators. Recruitment remains pending by user direction. `PHASE6_DEMO=1` with `client/test/browser-workflows.cjs` records fictional preloaded facts, real review/API/PDF export and deterministic processing. Automated demonstrations are not pilot participants. The full browser workflow also passed, including 36 workflow checks and 53 automated accessibility audits. Phase 6 is not claimed complete without real pilot results.
