const Profile = require('../models/CareerProfile');
const User = require('../models/User');
const Resume = require('../models/Resume');
const { cleanResumeContent, revision, text, fail } = require('./resumeContent');
const { resumeText } = require('../providers/resumeFacts');

async function getProfile(owner) {
  const profile = await Profile.findOne({ owner }).lean();
  if (profile) return profile;
  const user = await User.findById(owner).select('name email targetRolePreference');
  if (!user) throw fail('Account not found', 404);
  return { revision: 0, content: cleanResumeContent({ contactInfo: { name: user.name, email: user.email } }),
    targetRole: user.targetRolePreference || 'Fullstack Developer', experienceLevel: 'early', onboardingCompleted: false };
}
async function saveProfile(owner, input) {
  if (Object.keys(input).some((key) => !['revision', 'content', 'targetRole', 'experienceLevel', 'onboardingCompleted'].includes(key))) throw fail('Unsupported profile field');
  const expected = revision(input.revision), content = cleanResumeContent(input.content);
  const targetRole = text(input.targetRole, 'Target role', 120) || 'Fullstack Developer';
  if (!['student', 'early', 'mid', 'senior'].includes(input.experienceLevel)) throw fail('Choose a valid experience level');
  if (typeof input.onboardingCompleted !== 'boolean') throw fail('Onboarding status must be true or false');
  const update = { content, targetRole, experienceLevel: input.experienceLevel,
    onboardingCompleted: Boolean(input.onboardingCompleted), revision: expected + 1 };
  let saved;
  if (expected === 0) {
    try { saved = await Profile.create({ owner, ...update }); }
    catch (error) { if (error.code === 11000) throw fail('Profile changed elsewhere. Reload the latest version before saving.', 409); throw error; }
  } else saved = await Profile.findOneAndUpdate({ owner, revision: expected }, { $set: update }, { new: true, runValidators: true });
  if (!saved) throw fail('Profile changed elsewhere. Reload the latest version before saving.', 409);
  await User.updateOne({ _id: owner }, { $set: { targetRolePreference: targetRole } });
  return saved;
}
async function createResume(owner, input = {}) {
  const profile = await getProfile(owner);
  if (!profile.revision) throw fail('Save your career profile first');
  const content = cleanResumeContent(profile.content);
  if (!content.contactInfo.name || !content.skills.all.length && !content.workExperience.some((item) => item.company && item.role) && !content.projects.some((item) => item.title && item.description)) {
    throw fail('Add your name and at least one skill, experience or project first');
  }
  return Resume.create({ owner, title: text(input.title, 'Resume title', 120) || 'Career profile resume',
    parsedData: content, rawText: resumeText(content), processingStatus: 'COMPLETED',
    sourceType: 'profile', verifiedAt: new Date(), contentRevision: 1, aiProvider: 'user-verified', atsScoreStale: true });
}
module.exports = { getProfile, saveProfile, createResume };
