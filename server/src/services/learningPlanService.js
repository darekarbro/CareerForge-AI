const { getProfile } = require('./competencyService');
const Gap = require('../models/GapAnalysis');

const rubricVersion = 'learning-plan-v2';
function buildLearningPlan(profile, gaps = []) {
  const assessedTopics = profile.competencies.filter(item => item.status !== 'strength' && item.assessmentBasis !== 'unassessed');
  const topics = new Map(assessedTopics.map((item) => [item.topic.toLowerCase(), {
    topic: item.topic, reason: `${item.topic} has a latest-attempt ${item.assessmentBasis === 'technical' ? 'technical' : 'practice'} average of ${item.assessmentScore ?? item.averageScore}/100 across ${item.assessedSampleCount ?? item.sampleCount} question(s). Review the cited answers to choose what to practise.`,
    confidence: item.confidence, sourceEvidence: item.evidence.filter(evidence => evidence.technicalAssessment !== 'unassessed').slice(0, 3),
    requirementSources: [], difficulty: item.status === 'gap' ? 'Easy' : 'Medium',
  }]));
  // Use only the latest report per resume/JD pair; earlier reports may refer to content the user has since improved.
  const seenReports = new Set();
  for (const gap of gaps) {
    const reportKey = String(gap.resumeId) + ':' + String(gap.jobDescriptionId);
    if (seenReports.has(reportKey)) continue; seenReports.add(reportKey);
    for (const requirement of gap.requirementMatches || []) {
      if (!['required_skill', 'preferred_skill'].includes(requirement.category) || requirement.status === 'supported') continue;
      const key = requirement.label.toLowerCase(), item = topics.get(key) || {
        topic: requirement.label, confidence: 'unassessed', sourceEvidence: [], requirementSources: [], difficulty: 'Easy',
        reason: `${requirement.label} is not yet supported by evidence in a saved job match. Missing resume evidence does not establish a lack of skill: first check whether you already have a truthful example.`,
      };
      item.requirementSources.push({ analysisId: String(gap._id), resumeId: String(gap.resumeId), jobDescriptionId: String(gap.jobDescriptionId),
        requirementId: requirement.id, category: requirement.category, status: requirement.status, sourceText: requirement.sourceText, missingEvidence: requirement.missingEvidence });
      topics.set(key, item);
    }
  }
  return { generatedAt: new Date().toISOString(), rubricVersion,
    limitations: [
      'Plans are suggested practice steps, not verified course recommendations or proof of job readiness.',
      'A missing job-match citation can reflect omitted resume evidence rather than a skill gap. Confirm existing work before choosing training.',
      'Saved job matches can cover only selected resume entries. Check that selection and your other work before treating a missing citation as a training need.',
      'Only skill requirements from the latest saved report per resume/job pair and non-strength interview topics are used. Availability, eligibility and employer constraints require direct clarification.',
      'Complete the tasks in your own workspace and retain the resulting artifact. Task completion is not automatically verified; reassessment and a human review check the result.',
    ], items: [...topics.values()].slice(0, 8).map((item) => ({
      topic: item.topic, reason: item.reason, confidence: item.confidence, sourceEvidence: item.sourceEvidence, requirementSources: item.requirementSources,
      practiceTasks: [
        { title: `Explain ${item.topic} with one example`, instructions: `Review the cited answer or job requirement for ${item.topic}. Write a plain-language definition, one concrete example, and the assumption you are least certain about. If you already have evidence, identify the project and your own contribution.`, doneWhen: 'You can explain the concept without notes and point to a real or explicitly labelled practice example.' },
        { title: `Compare two approaches to ${item.topic}`, instructions: `Choose a small scenario involving ${item.topic}. Compare two approaches and describe one trade-off, a failure case and a test or observable check.`, doneWhen: 'Your notes include two alternatives, a justified choice, one failure case and the expected result of a check.' },
      ], projectMilestones: [
        { title: `Create a small ${item.topic} demonstration`, instructions: `Create the smallest useful artifact demonstrating ${item.topic}: a runnable example, a design document, or a worked analysis. Document your goal, inputs, assumptions and personal contribution.`, doneWhen: 'Another person can reproduce or inspect the example using your instructions and see the expected result.' },
        { title: `Test and improve the ${item.topic} example`, instructions: 'Add one edge case and one failure scenario. Record the observed behavior, fix a weakness, and write a short explanation of the trade-off. Keep evidence of the before and after states.', doneWhen: 'The artifact includes an observable validation result and a short explanation of what changed and what remains uncertain.' },
      ], reassessment: { topicFocus: item.topic, difficulty: item.difficulty, count: 3,
        successCriteria: ['Answer three focused questions using your own example and reasoning.', 'Explain a trade-off, a failure case and a test without inventing results.', 'Compare new feedback to the cited attempts and ask a reviewer to check technical accuracy; a higher automated score alone is insufficient.'] },
    })) };
}

function currentReports(gaps, resumes) {
  const revisions = new Map(resumes.map((resume) => [String(resume._id), resume.contentRevision || 1]));
  const seen = new Set(), current = [], excluded = { stale: 0, unversioned: 0, missingResume: 0 };
  for (const gap of gaps) {
    const key = String(gap.resumeId) + ':' + String(gap.jobDescriptionId);
    if (seen.has(key)) continue;
    // Select the latest report first. An obsolete latest report must not resurrect an older one.
    seen.add(key);
    const revision = revisions.get(String(gap.resumeId));
    if (!revision) excluded.missingResume++;
    else if (!Number.isInteger(gap.sourceRevision)) excluded.unversioned++;
    else if (gap.sourceRevision !== revision) excluded.stale++;
    else current.push(gap);
  }
  return { current, excluded };
}

async function getPlan(owner) {
  const [profile, gaps, resumes] = await Promise.all([getProfile(owner), Gap.find({ owner }).sort({ createdAt: -1 }).lean(),
    require('../models/Resume').find({ owner, deleting: { $ne: true } }).select('_id contentRevision').lean()]);
  const { current, excluded } = currentReports(gaps, resumes);
  const plan = buildLearningPlan(profile, current);
  return { ...plan, excludedReports: excluded, limitations: [...plan.limitations,
    'Job-match reports for older resume revisions and legacy reports without a source revision are excluded. Run Check job match again after editing a resume.'] };
}
module.exports = { getPlan, buildLearningPlan, currentReports, rubricVersion };
