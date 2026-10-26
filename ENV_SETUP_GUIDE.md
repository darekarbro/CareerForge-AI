# Environment setup

Use Node.js 20.19+, 22.13+, or 24+ with npm. Install dependencies in both server and client.

## Server

Copy server/.env.example to server/.env if you do not already have one. For an existing file, merge the settings you need.

### Groq

Add these settings to server/.env and replace the placeholder with your own key:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
GROQ_TIMEOUT_MS=30000
```

Restart the backend after changing environment variables. Settings displays Groq as the active provider when configured. Placeholder keys are ignored.

The default is openai/gpt-oss-120b; openai/gpt-oss-20b is an alternative for lower latency. Both support strict structured outputs. Model availability is documented in the [Groq model catalog](https://console.groq.com/docs/models) and [Structured Outputs guide](https://console.groq.com/docs/structured-outputs). Create/manage your key in the [Groq console](https://console.groq.com/keys).

All six AI operations use the same order: Groq → OpenRouter → Gemini → offline fallback. Failed requests, timeouts, invalid JSON and invalid result shapes move to the next configured provider. Cancellation stops the chain. These are server secrets; never add them as NEXT_PUBLIC variables.

### Server settings

| Variable | Default / purpose |
| --- | --- |
| PORT | 5000 |
| NODE_ENV | development; set production for deployed servers |
| CLIENT_URL | http://localhost:3000; comma-separated exact allowed frontend origins |
| JWT_SECRET | Development fallback only; production requires a private random secret of at least 32 characters |
| JWT_EXPIRES_IN | 7d |
| TRUST_PROXY | Blank by default; set only the trusted proxy hops/subnets for your deployment |
| AUTH_RATE_LIMIT_MAX | 100 authentication requests per IP per 15 minutes |
| AI_RATE_LIMIT_MAX | 30 expensive generation requests per account per 15 minutes; an additional IP limit is three times this value |
| MONGODB_URI | Required in production; development falls back to a temporary MongoDB if absent or unreachable |
| GROQ_API_KEY | Optional primary AI key |
| GROQ_MODEL | openai/gpt-oss-120b |
| GROQ_TIMEOUT_MS | 30000 per Groq attempt |
| OPENROUTER_API_KEY | Optional next provider |
| OPENROUTER_MODEL | Choose a model available to your OpenRouter account |
| GEMINI_API_KEY | Optional next provider |
| GEMINI_MODEL | gemini-3.8-flash; choose a model available to your Gemini account |
| AI_PROVIDER_TIMEOUT_MS | 15000 per OpenRouter/Gemini attempt |
| CLOUDINARY_CLOUD_NAME | Configure together with the Cloudinary key and secret |
| CLOUDINARY_API_KEY | Backend Cloudinary key |
| CLOUDINARY_API_SECRET | Backend Cloudinary secret |
| REDIS_URL | Optional redis:// or rediss:// URI; the database index in the URI is preserved |
| FIREBASE_PROJECT_ID | Required for Google sign-in; service-account project |
| FIREBASE_CLIENT_EMAIL | Required for Google sign-in; service-account email |
| FIREBASE_PRIVATE_KEY | Required for Google sign-in; service-account PEM key with escaped \n newlines |

Generate a production JWT secret locally:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Put the generated value in JWT_SECRET. The repository's old example/default secrets and placeholder values are rejected in production.

### Other service credentials

- [Firebase console](https://console.firebase.google.com/): enable Google sign-in, configure authorized frontend domains, and obtain the web config and backend service account. The backend requires verified Google identity claims.
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas): create a database user and copy the connection URI. Limit network access to the deployment's trusted hosts.
- [OpenRouter keys](https://openrouter.ai/keys) and [Google AI Studio](https://aistudio.google.com/): optional fallback keys. Select models currently available to those accounts.
- [Cloudinary console](https://console.cloudinary.com/): copy the cloud name, API key and API secret together.
- Redis: copy your service's complete Redis connection URL, including TLS scheme and database index.

Without Cloudinary, originals are stored under server/uploads and served through an authenticated, ownership-checked API. New Cloudinary uploads use authenticated delivery and short-lived signed download URLs. Use persistent private storage for a deployed server.

Without Redis, a bounded in-process queue runs background jobs. It is not durable across process restarts. Redis is recommended when job durability is required. Development MongoDB fallback data is temporary; production fails startup rather than falling back.

## Client

Copy client/.env.example to client/.env.local if needed. Merge into an existing file:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_web_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

Firebase web configuration is public client configuration. The service-account private key and Groq, OpenRouter, Gemini, Cloudinary and JWT secrets belong only in server/.env.

For deployment, use the actual frontend and backend origins. Rebuild/restart the client after changing NEXT_PUBLIC values.

## Run and verify

Start the backend and frontend in separate terminals from the repository root:

```powershell
npm run dev:server
npm run dev:client
```

Run validation from the repository root:

```powershell
npm test
npm run lint
npm run build
```

GET http://localhost:5000/api/health returns 200 when MongoDB is connected and 503 when it is unavailable. Provider configuration is shown in Settings. Configuration status does not prove the remote account has sufficient quota.

If a build hits memory limits, set NEXT_BUILD_WORKERS=1 and use Node 24. The final clean verification used Node 24.22.1 with NODE_OPTIONS=--max-old-space-size=512. This optional worker cap does not change normal builds.

Resume upload, tailoring, gap analysis, question generation and answer evaluation return HTTP 202 with a jobId. The client follows the owned processing-job status/timeline until COMPLETED, FAILED or CANCELLED. A parsed-text event alone does not indicate completion.

Startup applies compatibility repairs for legacy empty Firebase UIDs, plaintext profile-assigned passwords, duplicate tailored version numbers and inconsistent interview counts. Back up a persistent database before deploying schema changes.

See BUG_FIX_REPORT.md for the 52 audit resolutions and validation scope.
