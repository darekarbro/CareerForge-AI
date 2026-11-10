# Phase 6 result ledger

**Phase 6 is not complete.** This package provides reproducible local engineering evidence. Real Redis/container execution, a fresh paid-model comparison, consenting pilot results and public publication remain pending.

Measured 2026-11-09T14:38:58.381Z on Node v24.22.1, win32, 12 logical CPUs and 15.75 GiB RAM. Source revision: `ba31d6746277f9216f7602c156cc3979b945a4f7` with uncommitted changes. The raw report records the measured source digest: `7ab5d8db1aeef5787ff87b2b6a71abbeb29e5ce293fd3abfbc88d8ffd0616d3d`.

See [methodology and boundaries](../PHASE6.md) and [machine-readable results](PHASE6_OPERATIONAL_RESULTS.json). Workload latency was collected before starting the final regression rerun; recovery uses real elapsed leases.

| Concurrency | Completed / submitted | Jobs/second | Submit p95 ms | Read p95 ms | Queue p95 ms | Execution p95 ms |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 30 / 30 | 17.88 | 56.28 | 57.19 | 16.00 | 98.00 |
| 5 | 30 / 30 | 31.84 | 104.95 | 73.87 | 26.00 | 122.00 |
| 10 | 30 / 30 | 25.53 | 205.39 | 127.97 | 471.00 | 188.00 |

All 90 local assessment jobs completed with zero rejection/failure under this fixed, small warm-cache workload. This does not establish production capacity or external-provider throughput.

## Working demonstrations

- Passed: actual worker process termination leaves a recoverable lease.
- Passed: trace context joins API, job, provider, cache and export.
- Passed: malicious JD instructions and cross-account evidence probes cannot retrieve another account.
- Passed: database interruption returns unavailable and recovers without losing accepted jobs.
- Passed: JWT rotation revokes old sessions while separate payload encryption survives.
- Passed: killed worker recovers after its real 90 second lease and duplicate deliveries execute once.
- Passed: consistent logical backup restores records, indexes and original bytes into an empty database.
- Passed: complete private account deletion removes owned records, encrypted inputs and local originals.
- Passed: restored backup replays a restricted erasure ledger before reopening traffic.

Additional regression checks cover atomic job admission and spending races, provider cooldown/concurrency, a real slow HTTP timeout, schema-repair accounting, output limits and actual OTLP export to a loopback collector. Majority and journaled write acknowledgements were added after the outage drill exposed an accepted-write durability gap. The final passing run compares every accepted job ID before/after restart.

Validation: **370 server tests; 52 client tests; build and lint passed; zero server dependency-audit advisories.** The recorded browser demo passed its actual-suggestion-review and PDF-download assertions. This is a focused demo, not a claim that the full browser suite was rerun for Phase 6.

## Presentation artifacts

- [Architecture and data relationships](ARCHITECTURE.md)
- [Technical decisions and tradeoffs](PHASE6_DECISIONS.md)
- [20.84-second silent demonstration video](media/phase6-demo.webm)
- [Fictional source screenshot](media/phase6-source.png)
- [Suggestion review and export screenshot](media/phase6-review.png)
- [Activity, trace and budget screenshot](media/phase6-activity.png)

The video uses fictional preloaded source facts and real local UI/API/export with deterministic processing. It includes an explicit suggestion acceptance. Screenshots were visually inspected. It is not a pilot session.

## Completion gates

| Area | Evidence state |
|---|---|
| Local operational controls, load, fault and privacy drills | Passed within the documented local boundary |
| Real Redis/container failures | Script and CI job added; local attempt failed because Docker daemon is unavailable; no passing result claimed |
| Live-model selection quality/cost | Policy gate implemented; fresh vendor/model comparison pending; default external traffic remains disabled |
| Consenting user pilot | Consent/tasks/measurement kit prepared; recruitment pending by user direction |
| Professional package | Architecture, decisions, results, limitations, screenshots and short video prepared locally; public publication pending |

Resume-safe claim: implemented trace-correlated jobs, atomic per-user admission and conservative provider-budget reservations, then demonstrated local crash/database recovery, privacy restoration/deletion and measured deterministic workload behavior. Do not claim production scale, live-model attack resistance, pilot usability outcomes or full-project completion from this evidence.
