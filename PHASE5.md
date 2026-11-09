# Phase 5 — Application assistant

Start in **Job workspaces**. A job's description, selected resume entries, preparation pack, practice and application record share the same workspace. Existing resume editing and review flows remain available from the pack.

## 1. Import opportunities

Paste a public Greenhouse or Lever posting URL into **Import a job**. The app calls the source's public job API, shows its attribution and plain-text preview, and checks the current account's saved and archived jobs. **Use preview in editable job form** transfers the fields into the existing form; nothing is saved until **Create job workspace**. Company names inferred from a board slug are explicitly flagged for correction.

Other boards, unavailable postings and unsupported URLs offer manual entry. This retains the entered URL. Requests only target fixed public API hosts, with bounded response size, timeout and redirects disabled. The implementation follows the [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html) and [Lever Postings API](https://github.com/lever/postings-api); it does not fetch arbitrary web pages, use private credentials or submit applications.

## 2. Prioritize saved jobs

Set **Opportunity preferences** for roles, locations, work arrangements and companies to deprioritize. **Recommended first** orders saved opportunities; **Recently updated** remains available. Open **Why this recommendation?** for the scoring method, points, missing evidence, constraints requiring confirmation and citations.

Recognized skill requirements contribute up to 60 points, role preferences 20, locations 10 and work arrangements 10. Only configured or assessable criteria enter the denominator. Career evidence is scoped to the selected resume entries and current confirmed facts; conflicting skills receive no supported credit. Text matches do not establish eligibility, proficiency or hiring probability. Unknown requirements and stale entry selections remain visible for manual review.

## 3. Prepare an application

Select and save a resume in the workspace, then **Create preparation pack**. The pack brings together:

- The selected resume and its revision, with an editor link.
- A cover-letter draft based on confirmed career facts.
- Selected project examples with their evidence.
- Interview topics with evidence availability and preparation prompts.
- The workspace preparation checklist in the downloaded pack.

Edit and save drafts, check them against actual experience, then explicitly mark them reviewed. A reviewed cover letter unlocks the text pack download. The download includes the selected resume text, reviewed drafts, project examples, topics, checklist and citations. Job, resume or evidence changes invalidate the saved pack until regenerated and reviewed again. Regeneration replaces the drafts and clears reviews.

## 4. Schedule and follow up

**Track application** transfers the company, role, URL, workspace and current tailored resume version into the application editor. Add a deadline, interview date/time and follow-up date. Interview times are stored with their UTC offset. Dates appear in the **Upcoming reminders** section of Applications.

Each application controls in-app reminders, calendar alerts and lead time (at event time, 15 minutes, one hour or one day). Calendar alerts default off. **Export calendar** downloads an ICS file for the user's calendar app; stable event IDs and revision sequences are included. Deadline and follow-up dates are all-day events; interviews use UTC times. The app provides in-app reminders and calendar export; it does not send background email, push notifications or calendar invitations.

## 5. Keep useful records

Application records include recruiter name, email, phone and notes, plus a dated status timeline and status notes. Attach up to five PDF, DOCX or TXT files of 2 MB each. Attachment downloads require the owning account, and uploads/removals check the current application revision. Save a new record before attaching files.

**Import or export applications** accepts a file or pasted CSV. Export supplies the supported headings. Preview identifies invalid rows, duplicates within the file and existing account records. Select rows explicitly before import; the server validates and checks duplicates again. The import reports individual results and does not overwrite existing records. Imports are capped at 200 rows and 1 MB. Formula-like exported cells are escaped for spreadsheet safety. Attachments, resume snapshots and internal workspace IDs stay in the app rather than CSV.

Account archives include ranking preferences, preparation packs and attachment metadata. Archives with originals include attachment bytes in a separate directory. Account deletion removes all these owned records and their stored attachment bytes.

## 6. Review outreach

The preparation draft selector includes recruiter introductions, referral requests and application follow-ups. Draft generation quotes confirmed facts within the selected resume scope. Edits clear review status; checks flag some unsupported quantities, technologies and responsibilities. These checks do not establish semantic truth, so the candidate must review factual scope.

**Copy reviewed draft** rechecks source freshness and review on the server before copying. The app exposes no sending endpoint. The user chooses the destination and sends from their own messaging tool.

## Verification

The [Phase 5 validation report](docs/PHASE5_VALIDATION.md) records the completed checks and their test-data boundary.

Run from the repository root:

```powershell
npm test
npm run lint
npm run build
npm --prefix client run test:browser
```

The browser suite uses an isolated database and fictional accounts. Phase 5 covers public API preview through actual browser/API persistence (only the external posting response is replaced with a fixture), editable import, duplicates, manual fallback, multiple opportunities, ranking preferences, preparation review/export, outreach copying and staleness, application transfer, contacts, attachment upload/download, reminders, ICS, CSV and mobile accessibility. It continues through the existing resume, interview, account export and deletion workflows.

Unit and HTTP integration cases cover source URL restrictions, ranking citations and conflicts, draft review/freshness, owner isolation, revision conflicts, attachment privacy, CSV parsing/duplicates, calendar formatting, account archive contents and deletion. Live third-party API availability and delivery by a user's calendar or messaging app are outside the local test boundary.
