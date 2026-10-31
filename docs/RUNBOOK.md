# Operations runbook

## Readiness and jobs

Check `GET /api/health`. A disconnected MongoDB or missing fresh worker heartbeat returns 503. The queue field distinguishes Redis delivery from MongoDB-backed recovery. A configured AI provider is not a live health check. The app's Activity page shows owned status, persisted timeline, retry inputs expiry, and usage metadata.

For local containers:

```bash
docker compose --env-file .env.compose ps
docker compose --env-file .env.compose logs --tail 100 api worker
```

Do not paste secrets, resume content or tokens into tickets. Application logs intentionally omit request bodies and authorization headers. Reverse proxies and SMTP providers need their own log-retention rules.

| Symptom | Check and recovery |
| --- | --- |
| Pending job | Worker heartbeat, Redis connectivity and shared MongoDB. Producer never runs work locally. Recovery checks durable pending jobs every 30 seconds. |
| RUNNING/COMMITTING after worker crash | Lease lasts 90 seconds and renews every 10. After expiry, recovery reuses committed artifacts by processingJobId. Do not manually duplicate a COMMITTING request. |
| Failed request | Open Activity and retry while encrypted inputs remain. A maximum of five manual retries applies. If inputs expired or a key changed, start the action again from its saved resume/workspace. |
| Redis outage | API persists accepted jobs in MongoDB. A running worker's recovery queue handles them. Live events may pause; clients poll durable status. Repair Redis, then check for duplicate-free completion. |
| SMTP not delivering | SMTP host/TLS/credentials, verified sender and APP_URL. Outbox retries five times with backoff and removes encrypted delivery payloads after send or expiry. After fixing SMTP, request a fresh email after the one-minute cooldown. Never print the encrypted payload or token. |
| Verification/reset invalid | Links expire or were already consumed/replaced. Request a new link. Password change invalidates older recovery requests. |
| Sessions unexpectedly ended | Expiry, password change/reset, sign-out-all, account deletion or a signing-key change. Sign in again. A temporary auth-database outage returns 503 and keeps browser state. |
| Account deletion retrying | Worker availability, active operation/execution leases, shared uploads mount and Cloudinary credentials. Failed file deletion retries with capped backoff. Do not remove the manifest or mark completed manually. |
| Original file unavailable in export | Restore the original/mount or export records without originals and download available originals individually. Legacy cloud files may require storage configuration or re-upload. |
| Cleanup not immediate | Scheduled retention runs every 15 minutes. TTL deletion is asynchronous. Expired inputs and sessions are rejected before TTL cleanup. Lowered settings remove eligible supporting records on save. |

## Backup and restore

Back up MongoDB with your provider's tested snapshot tooling and back up the shared uploads volume at the same recovery point. Keep stable JOB_PAYLOAD_SECRET and JWT_SECRET in an access-controlled secret store. Redis is a dispatch accelerator; MongoDB job state is the durable recovery record. Mailpit is local development data and should not be used as a production mailbox.

Document your backup retention period and access policy before a public deployment. The UI describes app-side deletion; providers, SMTP and backups have independent retention. Preserve a restricted deletion ledger through the backup retention window, or expire backups promptly enough to honor the published policy. The app receipt is deliberately anonymous after completion and expires after seven days; it is not a long-term backup erasure ledger.

To restore, keep public traffic stopped, restore database and originals consistently, apply outstanding deletion requests/your retained erasure ledger, and run workers until cleanup finishes. Invalidate restored AuthSession records and rotate JWT_SECRET if restored sessions must not be resurrected. Restart API/worker together, verify readiness, inspect a fictional test account and confirm privacy settings before reopening traffic. Never restore a backup into an internet-accessible environment just to inspect it.

## Key changes and shutdown

Rotating JWT_SECRET ends all signed sessions. If JOB_PAYLOAD_SECRET is blank it also invalidates retry/mail payloads; prefer a separate stable encryption secret. Rotating JOB_PAYLOAD_SECRET makes existing encrypted retry inputs and pending account emails unreadable. Let active jobs drain first, remove unusable encrypted payloads under controlled maintenance, and request fresh mail/actions afterward. Do not silently decrypt with an old default key.

SIGTERM/SIGINT stops timers, drains workers and closes database/socket connections with a bounded API shutdown deadline. Container stop/start tests check queued work recovery and persistent originals. Use `docker compose --env-file .env.compose down` to stop the local stack without deleting named volumes.

## Validation commands

```bash
npm test
npm run lint
npm run build
npm --prefix client exec playwright install chromium
npm --prefix client run test:browser
node scripts/testCompose.cjs
```

Browser acceptance needs a production client build pointing at localhost:5000 and ports 5000/3030 free; it starts an isolated API/database. Container acceptance needs the Compose stack running instead. Live Groq checks are a separate explicit opt-in command, `npm --prefix server run test:groq`; they send fictional fixtures only and consume provider quota. The normal suites load no developer credentials.
