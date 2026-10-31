# Phase 2 workflows

## First resume and job preparation

1. Register, verify the email link and choose AI sharing preferences in Account & privacy. Sharing stays off until explicitly enabled.
2. Set a target role and experience level. The profile has prompts for students, career changers and working professionals. Supply responsibilities, personal contributions, tools and outcomes you can verify. Unknown outcomes can stay blank.
3. Build the profile manually or upload a resume. Open **Compare with original source** to inspect extracted facts beside the original PDF or saved source text. Review cues identify missing fields and wording not found verbatim; they are not statistical confidence scores.
4. In the career profile, choose a saved resume and **Review import**. Select individual incoming fields. Existing skills are merged, new entries are appended, and unselected facts remain unchanged. Importing does not save until the profile draft is synchronized.
5. Check dates and possible duplicate entries. Use **Section order** and entry movement controls with mouse or keyboard. Name meaningful revisions; open history to compare fields or restore a previous revision as a new revision.
6. Create a resume from the saved profile, then create a job workspace. Select the experience and projects relevant to that job. These choices apply to tailoring, match analysis and interview preparation, while the source keeps all entries.
7. Review AI suggestions and their explanations. Accept, keep original or edit individual fields. Review progress records the decisions. Editing a different field preserves earlier decisions; undo/redo stays available.
8. Choose export settings and save the layout for that version. Preview the actual PDF and its page count, then download PDF or editable DOCX. Unsaved content must synchronize before export.
9. Use the preparation checklist and application tracker. Archive completed or paused jobs and restore them later. Duplicate jobs link to the existing workspace, including archived jobs.

## Revision and conflict behavior

Content saves use optimistic revision numbers. A conflicting save keeps the local draft and loads the latest server values for comparison. Changes to separate fields merge automatically; overlapping fields require individual choices. Entry identities keep edits attached to the correct entry after reordering. A deletion competing with an edit also requires a choice. The resolved result is saved against the latest revision; another concurrent save can trigger another comparison.

Profile history retains 30 previous revisions, source resumes 20 and reviewed versions 30. Restoring creates a new revision. Local drafts include their original base values and are cleared on sign-out. Older local drafts without a known base require choices for overlapping values. Names, content and section order participate in comparisons. Layout preferences use a separate revision so changing margins cannot overwrite content edits.

Workspace inputs have a separate preparation revision. Notes/checklist edits do not invalidate a pending result, while changing the role, job description, resume or selected entries prevents an old job from replacing current result links. Job-specific inputs are captured before dispatch. Practice completion is checked against the workspace inputs and resume revision. Archiving retains resumes, practice and application history and pauses new workspace preparation.

## Export coverage

PDFs embed subsets of the bundled SIL Open Font License Noto fonts: Latin, Greek, Cyrillic, Devanagari and CJK. The CJK fallback uses Simplified Chinese regional glyph forms. This is tested coverage, not a promise of every Unicode script or emoji. Unsupported glyphs produce a readable error with the DOCX alternative. Font files, licenses, source URLs and checksums live in `server/src/assets/fonts`.

Page-break controls start selected sections on a new page. Experience/project blocks stay together when they fit on one page; longer blocks flow to subsequent pages. Long URLs wrap without truncation. DOCX preserves Unicode text and page-break instructions, but the receiving editor controls installed fonts and final pagination.

## Verification

`npm test` covers backend and frontend regressions, including selection snapshots, owner isolation, named histories, date validation, selective imports, field conflicts, review decisions, layout revisions and Unicode round trips. `npm run lint` and `npm run build` check all frontend routes.

After building, `npm --prefix client run test:browser` exercises registration through deletion with fictional data, keyboard interactions and axe WCAG 2.0/2.1 A/AA audits. It writes screenshots, accessibility findings and a trace to `.test-tmp/browser-*`. Automated audits complement manual keyboard, mobile and rendered PDF inspection; they do not establish complete accessibility conformance.

`node scripts/testCompose.cjs` checks the separate API/worker services, SMTP, persistence, Redis outage recovery and Phase 2 exports/workspaces. `npm --prefix server run test:groq` is the opt-in live provider check using fictional inputs. See `PHASE2.md` for the final validation results and `docs/DEPENDENCY_AUDIT.md` for dependency limitations.
