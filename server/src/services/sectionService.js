const { fail } = require('./resumeContent');
const { plain } = require('../providers/resumeFacts');
const { createJob, dispatchJob } = require('./jobService');
const tailoring = require('./tailoringService');
const sections = ['summary', 'workExperience', 'projects'];
async function request(resumeId, versionId, owner, input) {
  await require('./resumeService').getReadyResume(resumeId, owner);
  const version = await tailoring.getTailoredVersion(versionId, owner);
  if (String(version.resumeId) !== resumeId) throw fail('Version not found', 404);
  const source = plain(version.sourceContent || (await require('./resumeService').getReadyResume(resumeId, owner)).parsedData);
  if (!sections.includes(input.section)) throw fail('Choose summary, experience or a project');
  if (input.section !== 'summary' && (!Number.isInteger(input.index) || !source[input.section]?.[input.index])) throw fail('Section entry not found');
  return dispatchJob(await createJob({ userId: owner, jobType: 'section_rewrite', inputRef: { resumeId, versionId,
    rawInput: { section: input.section, index: input.index } } }));
}
async function processSection({ job, checkpoint, commit }) {
  const version = await tailoring.getTailoredVersion(job.inputRef.versionId, job.owner);
  const resume = await require('./resumeService').getReadyResume(job.inputRef.resumeId, job.owner);
  const source = plain(version.sourceContent || resume.parsedData), { section, index } = job.inputRef.rawInput;
  const scoped = section === 'summary' ? source : { ...source, summary: '', workExperience: [], projects: [], [section]: [source[section][index]] };
  const result = await require('../agents/generatorAgent').tailorResume({ resumeData: scoped, targetRole: version.targetRole,
    jobDescriptionText: version.jobDescriptionText, jobId: job._id, userId: job.owner });
  await checkpoint();
  const candidate = { ...scoped, summary: result.summary, workExperience: result.workExperience, projects: result.projects };
  for (const key of ['workExperience', 'projects']) candidate[key] = (candidate[key] || []).map((entry, number) => ({ ...entry, entryId: require('./resumeStructure').withEntryIds(scoped)[key][number]?.entryId }));
  const report = await require('./claimEvidenceService').prepare(job.owner, resume, scoped, candidate, version.evidenceSnapshot?.length ? version.evidenceSnapshot : undefined, version.sourceRevision);
  await checkpoint();
  return commit(async () => ({ section, index, value: section === 'summary' ? report.content.summary : report.content[section][0], claimEvidence: report.claims.filter((claim) => claim.path[0] === section), aiProvider: result.aiProvider }));
}
module.exports = { request, processSection };
