# Dependency audit — 1 November 2026

PR #9 removes the moderate dependency findings recorded at `101f5be`. Full audits include development dependencies; production audits are checked separately. No advisory exceptions, reduced audit scope or forced downgrades are used.

| Scope | Before | After remediation |
| --- | --- | --- |
| Client production (`--omit=dev`) | 0 | 0 |
| Client including development tooling | 6 moderate | 0 |
| Server production (`--omit=dev`) | 6 moderate | 0 |
| Server including development tooling | 7 moderate | 0 |

The underlying advisories are [minimatch pattern amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249) and [glob traversal after cancellation](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). npm also counts affected parents as findings, so the original totals were not independent vulnerabilities.

## Changes and compatibility

- Both manifests override minimatch to `^11.0.1`; both lockfiles resolve all copies to `11.0.3`.
- The server overrides glob to `^14.0.2`, resolving to `14.0.3`. Its rimraf and nodemon consumers use the named APIs available in these patched versions.
- The client moves to ESLint `10.14.0` and `@eslint/js` `10.0.1`. `eslint-plugin-react-x` `5.28.8` replaces `eslint-plugin-react`, whose minimatch calls still require the old callable export. JSX list-key checks and React hook checks remain enabled. ESLint 10 tracks JSX references natively, so the old JSX variable-marker rules are removed. See the [ESLint migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0) and [React list-key rule](https://eslint-react.xyz/docs/rules/no-missing-key).
- The supported runtime remains Node 24, matching `.nvmrc`, containers and CI. Lockfiles retain npm integrity hashes and are installed with `npm ci`.

The earlier automatic fix dry run offered incompatible downgrades and changed no packages. This follow-up explicitly changes the dependency graph and validates the new major versions instead of applying those downgrades.

## Regression checks

`server/test/dependencyCompatibility.test.js` checks that aborted glob traversal schedules no additional directory reads, rimraf's asynchronous and synchronous glob cleanup still work, nodemon preserves watch/ignore/extension matching, and Firebase verifies real signatures while rejecting invalid signatures, wrong audiences/issuers and expired tokens. Certificate downloads are replaced with a fictional trusted test key; signature and claim verification use the real SDK.

`client/test/dependencyCompatibility.test.cjs` checks missing JSX keys, conditional hooks, missing effect dependencies, valid JSX references, source-file selection and generated-file exclusions. These tests guard against a superficially clean audit that breaks consumers or silently disables linting.

CI runs `npm audit --audit-level=moderate` in both directories after clean installs. Full backend/frontend suites, lint, production builds, browser workflows, accessibility checks and the separate API/worker container acceptance suite remain required. Audit and functional results are separate checks. Re-run full and production audits before deployment because advisories change over time.

## Validation on the remediation branch

Both normal `npm ci` installs completed successfully. Fresh full and production-only audits returned zero findings in all four scopes. The backend passed 112 tests and the frontend passed 36 tests, including the six new compatibility regressions; none were skipped. Lint passed with zero warnings, the production build generated all 29 pages, and all 23 browser workflow groups plus 41 WCAG A/AA audits passed with zero violations.

Live Groq acceptance passed all 15 checks using 14 real requests across all six AI actions, answer retries, persisted results, scoped evidence copilot and PDF export. Fallback was disabled and all career data was fictional.

Fresh API, worker and frontend container builds passed. All six Compose acceptance groups passed, covering independent workers, SMTP, private uploads, Redis socket events/outage recovery, restart persistence, profile/resume/evidence workflows, account archives and background deletion. Existing volumes were preserved.
