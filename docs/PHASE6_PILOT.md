# Consenting user pilot — recruitment pending

No participants have been recruited and no pilot results are claimed. Automated fictional accounts and the demonstration are engineering checks, not pilot users.

Recruit 3–5 adults who understand this is an unfinished career drafting tool. Invite them yourself; the app sends no recruitment messages. Offer fictional sample career data. Do not ask for employer secrets, references' contact details or credentials. External AI sharing starts off; explain any sharing before enabling it. Participation is optional, withdrawal is allowed, and screen recording requires separate explicit permission.

## Consent text

“I agree to try CareerForge for about 20 minutes. I understand its suggestions may be wrong and need review. I can use fictional information, skip any task or stop. My results will be recorded under a participant code. My resume and private text will not appear in public project materials. I can ask for deletion using the agreed contact route. I separately choose whether my screen may be recorded.”

Record consent time, version of this text, participant code and recording choice in a private register. State a deletion date and contact route before starting. Keep the register, contact details, recordings and raw notes outside Git. Publish only anonymous aggregates after checking that free text cannot identify anyone.

## Fixed tasks

1. Create a profile or import the fictional resume. Correct one fact.
2. Save a job and select the relevant resume entries.
3. Generate a draft, review at least three suggestions, keep or reject them, then download a PDF.
4. Prepare a cover letter, mark it reviewed and download a pack.
5. Find Activity, explain what is running, then export or delete the account.

Start the timer when the participant reaches the signed-in dashboard. Stop each task when its stated result is visible. Time to first export is the first successful download minus that start. Record first-export format separately. Pauses, facilitator help, and abandoned tasks remain in the denominator; missing exports are censored, not zero seconds. A new run or helped retry must not replace the first attempt.

For each task record success without help / success with help / abandoned, elapsed seconds, confusing step, help count and participant explanation. For suggestion acceptance, count explicit Accept / Keep original / edited / unreviewed decisions; acceptance rate is Accept divided by Accept + Keep original + edited, with unreviewed reported separately. “Edited” is not an acceptance. Aggregate per participant before aggregating the group to avoid one prolific reviewer dominating the result.

## Private results template

```csv
participant_code,consent_version,consent_at,recording_consent,task,first_attempt_outcome,elapsed_seconds,help_count,confusing_step,first_export_seconds,export_format,accepted,kept_original,edited,unreviewed,withdrawn
```

Use explicit nulls for missing measurements. Report sample size, completion with/without help, censored exports, median/range of time to first export, top confusing steps and suggestion decisions. Do not generalize usability or hiring outcomes from 3–5 participants. Publish an aggregate results note only after the pilot and requested withdrawals are resolved.
