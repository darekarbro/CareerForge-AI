# Phase 2: resume workflows and user experience

Completed on 31 October 2026. Review branch: `Phase-2`, based on `Phase-1`. No merge is part of this work.

- [x] Guided career questions for students, experienced candidates and career changers.
- [x] Source comparison, uncertain extraction flags and selective profile imports.
- [x] Section ordering, duplicate warnings, date validation and job-specific entry selection.
- [x] Named revisions, comparisons and field-by-field conflict resolution.
- [x] Explained AI changes, review progress and decisions preserved during manual edits.
- [x] Saved version layouts, page-break controls and embedded Unicode fonts.
- [x] Workspace archive/restore, duplicate detection and preparation checklists.
- [x] Accessible forms/states, keyboard checks and automated accessibility audits.
- [x] Full local regression, browser, export, container and live AI validation.

## Delivered behavior

Imports show source text or a private PDF beside extracted fields and individual merge choices. Stable entry identities preserve edits and AI decisions after reordering. Named revision histories include comparisons and restoration; conflicting edits to separate fields combine automatically, while overlapping changes require a choice.

Job workspaces capture the selected experience/projects before dispatch. Separate preparation revisions prevent late workers from replacing current results after inputs change. Duplicate detection includes archived jobs and canonical job URLs. Archive/restore preserves related work. Automatic checklist steps reflect verified source facts, completed suggestion review and practice using the current inputs; manual steps remain editable.

Version layouts have their own optimistic revision. PDF export embeds bundled fonts, keeps entries together when practical and honors section page breaks. Tests cover accented Latin, Devanagari and CJK names plus very long links. An unsupported glyph produces a helpful error. DOCX preserves editable Unicode text; receiving editors determine fonts and pagination.

The browser tests also found and resolved nested model ID aliases that blocked saving reviewed projects, delayed checklist checkbox feedback, unlabelled controls, mismatched voice-control names, contrast failures and non-focusable scrolling regions. Live testing exposed a Groq malformed-JSON error; the provider now makes one bounded format-repair retry under the original cancellation/deadline. Authentication and ordinary request errors are not retried by that repair.

## Validation

All tests use fictional data and isolated services. Environment files, real credentials, temporary databases and generated evidence are excluded from Git.

| Check | Result |
| --- | --- |
| Complete backend suite | 78 passed, 0 failed/skipped |
| Complete frontend component suite | 27 passed, 0 failed/skipped |
| ESLint | Passed, 0 warnings |
| Production Webpack build | All 27 pages built |
| Full browser acceptance journey | 17 workflow groups passed |
| axe WCAG 2.0/2.1 A/AA checks | 29 audits, 0 violations |
| Manual keyboard/mobile checks | Section movement, conflict focus/choices, navigation Escape/focus and 390 px layout checked |
| Export inspection | Classic/modern/compact: 5/6/4 pages for the international stress fixture; all 15 rendered pages inspected, no text outside page bounds; full long links retained |
| PDF/DOCX round trips | International names and late experience/education/certificates retained |
| Docker Compose | API, independent worker, frontend, MongoDB, Redis and Mailpit built and became healthy; all five acceptance groups passed |
| Container recovery | Worker pause/restart, API restart, persistent sessions/files, Redis outage and MongoDB job recovery passed |
| Live Groq | All 6 actions, 11 HTTP 200 requests, 12 checks; fallback disabled |
| OpenAPI contract | Valid schema and all 85 mounted operations documented |
| Secret/whitespace checks | No configured credentials found in changed source; diff whitespace check passed |

Container acceptance includes the new profile, selection, duplicate-job, checklist, archive/restore, named history and embedded-font export paths. Browser acceptance covers registration, verification, tailoring, individual review, actual PDF preview, DOCX download, applications, interview retry, account recovery/export and deletion. Screenshots, traces and accessibility results are retained by CI in its browser-evidence artifact.

Initial live runs exposed a format error and a per-minute Groq quota response. After the bounded repair and more conservative acceptance-run pacing, the complete live run passed. This verifies functionality within the configured quota, not unlimited concurrency.

Automated accessibility checks do not establish complete conformance. Font coverage and DOCX pagination limits are described in the [workflow guide](docs/PHASE2_WORKFLOWS.md). The dependency audit still reports upstream moderate findings; see the [audit and upgrade limitation](docs/DEPENDENCY_AUDIT.md). No high or critical dependency advisories were reported by this audit.

GitHub checks run again on the pushed PR head. This branch is intended for manual review and remains unmerged.
