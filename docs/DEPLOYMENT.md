# Setup and deployment

## Local containers

Use Docker with Linux containers and Compose v2. From the repository root:

```bash
node scripts/setupLocal.cjs
docker compose --env-file .env.compose config --quiet
docker compose --env-file .env.compose up --build -d --wait --wait-timeout 180
node scripts/testCompose.cjs
```

The setup script creates private random keys in ignored `.env.compose` and preserves that file on subsequent runs. It does not read or overwrite native environment files. Optional Groq/Firebase configuration can be added there. Never commit it. MongoDB, Redis, uploads and Mailpit use named persistent volumes. Host ports bind to 127.0.0.1: frontend 3000, API 5000 and email inbox 8025. MongoDB/Redis/SMTP are internal. Mailpit captures mail locally without forwarding it.

Register at http://localhost:3000, verify through http://localhost:8025, then choose sharing in Account & privacy. AI keys alone do not grant per-account sharing consent. Documentation is available at http://localhost:5000/api/docs; download the specification from `/api/openapi.json`.

`docker compose --env-file .env.compose down` preserves volumes. Do not use `down -v` unless intentionally erasing local data. Rebuild after changes to code or NEXT_PUBLIC_* build arguments. Stop containers before native/browser tests that need port 5000.

## Native development

Use Node 24 from `.nvmrc`. Run `npm ci` in server and client. Copy server/.env.example to server/.env and client/.env.example to client/.env.local. Configure a persistent MongoDB for data you want to keep; the optional development memory database is discarded on shutdown. Set QUEUE_MODE=combined for one API/background process and start `npm --prefix server run dev` plus `npm --prefix client run dev`.

Account verification needs SMTP. A local Mailpit server can listen on localhost:1025; SMTP_REQUIRE_TLS=false is appropriate only for that local inbox. The supplied Compose file keeps SMTP internal. To use its inbox from a native API, add a local-only port mapping `127.0.0.1:1025:1025` to Mailpit in an ignored Compose override, or run a separate local SMTP inbox. Do not point test suites at a real email account.

## Production services

The supplied Compose file is a localhost development deployment. For hosted use, configure infrastructure explicitly:

| Service | Required configuration |
| --- | --- |
| Frontend | HTTPS hostname; NEXT_PUBLIC_API_URL and NEXT_PUBLIC_SOCKET_URL as build arguments pointing to the public API. Firebase web configuration is public. |
| API | NODE_ENV=production, QUEUE_MODE=producer, persistent MONGODB_URI, REDIS_URL, private JWT_SECRET (32+ characters), stable JOB_PAYLOAD_SECRET, exact CLIENT_URL origins and one trusted APP_URL. Expose HTTPS behind a trusted proxy. |
| Worker | QUEUE_MODE=worker; same MongoDB, Redis, signing/encryption keys, SMTP and AI settings; same uploads mount or authenticated Cloudinary configuration. Run `npm run worker`. No public port. |
| Storage | Shared persistent uploads mounted at /app/uploads, or authenticated Cloudinary originals. An ephemeral filesystem loses originals. Back up files and database together. |
| Email | SMTP_HOST/PORT; SMTP_SECURE=true for implicit TLS or SMTP_REQUIRE_TLS=true for STARTTLS. Set credentials and a verified MAIL_FROM domain. APP_URL must be the real HTTPS frontend origin. |
| Database / Redis | Private network, authenticated connections/TLS as required by your service, persistent storage and controlled backups. Redis AOF is enabled locally. |

Production fails startup without persistent MongoDB or a sufficiently private JWT secret. Separate process modes require Redis. Provider APIs remain optional; external sharing is per user. Never set private credentials in NEXT_PUBLIC_* variables. Firebase Admin keys, SMTP passwords and provider keys stay in the API/worker secret store. The Docker build context excludes environment files, uploads and Git metadata; containers run as a non-root user.

Set TRUST_PROXY only to the known proxy hop count or subnet so IP limits reflect clients correctly. Permit WebSocket upgrades and sensible upload/time limits at the proxy. Ensure private account exports/originals and API responses are not cached by a CDN. Protect Mailpit behind localhost; production uses a real SMTP service instead of a public development inbox.

## Upgrade and review

Back up MongoDB, private originals and stable encryption keys first. This release adds collections/indexes through Mongoose and preserves domain records. Existing JWTs without a session ID/issuer/audience require sign-in again. Existing local accounts need email verification, and provider-sharing defaults are off. Tell users to verify through Account & privacy and explicitly choose providers. Old six-character passwords can still sign in; newly registered/reset/changed passwords require eight characters and at most 72 UTF-8 bytes.

Deploy API and worker from the same revision. Wait for worker heartbeat and `/api/health` readiness before sending traffic, then check SMTP verification/recovery on a test account and run the smoke workflow. Keep backward-compatible backups for rollback; rolling back authentication code could bypass session revocation, so stop traffic and revoke sessions before any security rollback.

CI installs from lockfiles using Node 24 on Ubuntu 24.04, runs backend/frontend tests, lint, the production build and Chrome journeys, then separately builds the full Compose stack and tests SMTP, worker isolation, Redis socket events/outage recovery, restart persistence, export and deletion. Official action revisions are pinned. Browser tests use the hosted runner's installed Chrome and print its version, avoiding a separate browser/dependency download. Screenshots/traces contain fictional fixture data and expire after seven days. No live API keys are needed in CI.
