# Dependency audit — 31 October 2026

The Phase 2 dependency audit is separate from functional test results. No high or critical advisories were reported in either package tree at the time of this check.

| Scope | npm audit result |
| --- | --- |
| Client production (`--omit=dev`) | 0 advisories |
| Client including development tooling | 6 moderate findings through ESLint / minimatch |
| Server production (`--omit=dev`) | 6 moderate findings through Google/Firebase transitive packages, rimraf, glob and minimatch |
| Server including development tooling | 7 moderate findings, also including nodemon / minimatch |

The underlying advisories are [minimatch pattern amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249) and [glob traversal after cancellation](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). npm counts affected parent packages as findings too; these counts do not mean 13 independent underlying vulnerabilities.

The project does not expose a public endpoint accepting glob patterns. The affected server dependency path includes the Firebase package's Google Firestore dependencies; the application currently uses Firebase authentication. This reduces the apparent exposure in current flows, but is not proof of non-exploitability.

The audit's suggested automatic fixes include incompatible major downgrades for ESLint/nodemon. A non-forced server fix dry run made no changes. Those changes and broad major-version overrides were not applied as part of the UX phase. The remaining moderate findings need an upstream-compatible dependency upgrade and dedicated compatibility checks. Re-run `npm audit` and `npm audit --omit=dev` in both directories before production deployment, because advisories change over time.
