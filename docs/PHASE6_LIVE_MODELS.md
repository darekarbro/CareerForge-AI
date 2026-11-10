# Phase 6 live model comparison

Completed 2026-11-10T11:10:45.203Z using fictional text only. The two models received the same eight resume and eight interview fixtures, adapter, schemas, evaluator and labels. Hashes are retained in the [raw comparison](PHASE6_LIVE_MODEL_RESULTS.json). These are development/regression cases, not a new holdout or human pilot.

| Model | Accepted | Exact contact fields | Interview band + branch | Parse p95 ms | Interview p95 ms | Token-cost estimate |
|---|---:|---:|---:|---:|---:|---:|
| openai/gpt-oss-120b | 16/16 | 16/16 | 8/8 | 2287.19 | 2094.78 | $0.006506 |
| openai/gpt-oss-20b | 16/16 | 16/16 | 8/8 | 1722.03 | 2573.54 | $0.003526 |

Each model met the 0.90 fixture quality gate. Selected prototype model: **openai/gpt-oss-20b** by lower unit rates after passing quality. The 20B model had lower median latency, but its interview p95 was worse; this does not establish uniformly better speed or broad quality equivalence.

The run used **32 physical requests** with **$0.074594 reserved**, below the $0.20/40-attempt cap. Estimates sum every reported input token at the uncached price and every output token at the output price, so they omit cache discounts and are not invoices. Rate sources checked 10 November 2026: [120B](https://console.groq.com/docs/model/openai/gpt-oss-120b) and [20B](https://console.groq.com/docs/model/openai/gpt-oss-20b).

A local aggregation error occurred after the 120B calls completed. Its completed raw report was reused rather than billed again. Exact serialized requests were reconstructed offline under matching adapter/fixture hashes and output cap, and their reservations/attempts were seeded into the resumed ledger. This provenance is explicit in the raw comparison. No model responses were replaced or repaired locally for scoring.

The [measured prototype policy](../config/model-policy.measured.json) uses the maximum observed serialized input size for each model, the evaluated 4096-token output cap, measured quality and action p95. It does not silently enable external traffic. For native use from the server directory, explicitly set `GROQ_MODEL=openai/gpt-oss-20b` and `AI_MODEL_POLICY_PATH=../config/model-policy.measured.json`; existing account opt-in and verified-email checks still apply. Larger requests fall back locally because they exceed the measured envelope.

Reproduce with Node 24: `node server/scripts/phase6LiveModels.cjs --live`. It reads the Groq key from the private server .env, isolates the database, keeps consent/concurrency/cost accounting active, and sends only fictional fixtures. Do not rerun merely to improve a published score. Retain failed/partial runs, price verification date and source hashes.

Limits: small selected synthetic development set, one run/model, sequential vendor quota pacing, WAN/vendor variability, and no independent human scores. Passing these fixtures does not establish general factuality, universal prompt-injection resistance, hiring outcomes or production capacity.
