# Phase 5 validation

Verified on 9 November 2026.

All six application-assistant features are implemented and committed. The browser workflow manages three saved opportunities and three application records, transferring job details into preparation and application tracking without retyping them.

| Check | Result |
| --- | --- |
| Server unit, contract and HTTP integration suite | 360 passed, 0 failed |
| Client component and regression suite | 52 passed, 0 failed |
| Production frontend build | Passed |
| ESLint, maximum warnings zero | Passed |
| Full browser workflow | 36 checks passed |
| Automated WCAG 2.0/2.1 A and AA audits | 53 audits, 0 violations |

## Acceptance evidence

| Feature | Verified behavior |
| --- | --- |
| Job import | Public API preview, source attribution, editing before save, reload persistence, duplicate detection, unsupported-source manual fallback and retained URL |
| Opportunity ranking | Several jobs, persisted role/location/work preferences, explained points, cited skill evidence, negative statements, scope restrictions and account isolation |
| Preparation pack | Selected resume revision, relevant projects, interview topics, editable cover letter, explicit review, checklist/text export and invalidation after source changes |
| Reminders and calendar | Deadline, interview and follow-up dates; timezone-preserving interview times; reminder toggles; ICS events and opt-in alarms |
| Application records | Workspace autofill, recruiter contacts, status timeline, private attachment upload/download, revision-safe refresh, CSV preview, errors, duplicates, selective import and export |
| Outreach | Grounded drafts, saved edits/review, server freshness checks before copying, native clipboard content and explicit user control of sending |

The browser continues through interview practice, evidence-linked progress, activity, mobile layouts, password recovery, private account export and permanent deletion. HTTP tests separately verify attachment privacy, account isolation, revision conflicts, pack source freshness, archive contents and deletion of derived preparation snapshots when their resume is removed.

## Verification boundary

Runtime source was isolated from commit `a00d6f0`, with the browser evidence-refresh correction from `19ccdbb`. Concurrent, unrelated backend edits in the shared workspace were left untouched. The isolated frontend used a separate build directory and local ports 3135/5505 because another task used the normal API port.

Tests used fictional accounts and a private temporary database. The public posting response was substituted with a bounded Greenhouse fixture; browser requests, API validation, persistence, duplicate checks and subsequent preparation/application actions were real. Live job-provider availability, a user's calendar alert delivery and external message sending were not tested. Sending remains an explicit action in the user's own messaging tool.

The earlier browser test incorrectly expected learning milestones from obsolete job reports after resume edits. It now refreshes the actual job assessment before testing gap-specific milestones; unassessed interview feedback remains unassessed.

## Local evidence

- `.test-tmp/phase5-server-final-results.log`
- `.test-tmp/phase5-client-results.log`
- `.test-tmp/phase5-build-results.log`
- `.test-tmp/phase5-isolated-build-results.log`
- `.test-tmp/phase5-lint-results.log`
- `.test-tmp/phase5-browser-results.log`
- `.test-tmp/phase5-snapshot/.test-tmp/browser-results.json`
- `.test-tmp/phase5-snapshot/.test-tmp/browser-trace.zip`

The browser report also lists screenshots of ranking, preparation review, the application editor and mobile workspaces. Generated evidence stays outside Git. See [the Phase 5 workflow guide](../PHASE5.md) for usage and the standard verification commands.
