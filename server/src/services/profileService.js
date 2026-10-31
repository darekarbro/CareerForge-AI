const Profile = require('../models/CareerProfile');
const User = require('../models/User');
const Resume = require('../models/Resume');
const { cleanResumeContent, revision, text, fail } = require('./resumeContent');
const { resumeText, plain } = require('../providers/resumeFacts');
const structure = require('./resumeStructure');
async function getProfile(owner) {
  const profile = await Profile.findOne({ owner }).select('-revisionHistory').lean();
  if (profile) return { ...profile, content: structure.withEntryIds(profile.content), presentation: structure.presentation(profile.presentation) };
  const user = await User.findById(owner).select('name email targetRolePreference');
  if (!user) throw fail('Account not found', 404);
  return { revision: 0, revisionName: 'Career profile', presentation: structure.presentation(), content: cleanResumeContent({ contactInfo: { name: user.name, email: user.email } }),
    targetRole: user.targetRolePreference || 'Fullstack Developer', experienceLevel: 'early', onboardingCompleted: false };
}
const snapshot = (profile) => ({ revision: profile.revision, name: profile.revisionName || 'Career profile', content: structure.withEntryIds(profile.content),
  targetRole: profile.targetRole, experienceLevel: profile.experienceLevel, onboardingCompleted: profile.onboardingCompleted,
  presentation: structure.presentation(profile.presentation), savedAt: profile.updatedAt });
async function saveProfile(owner, input) {
  if (Object.keys(input).some((key) => !['revision', 'revisionName', 'presentation', 'content', 'targetRole', 'experienceLevel', 'onboardingCompleted'].includes(key))) throw fail('Unsupported profile field');
  const expected = revision(input.revision), content = cleanResumeContent(input.content), before = await getProfile(owner);
  const targetRole = text(input.targetRole, 'Target role', 120) || 'Fullstack Developer';
  if (!['student', 'early', 'mid', 'senior', 'changer'].includes(input.experienceLevel)) throw fail('Choose a valid experience level');
  if (typeof input.onboardingCompleted !== 'boolean') throw fail('Onboarding status must be true or false');
  const update = { content, targetRole, experienceLevel: input.experienceLevel, onboardingCompleted: input.onboardingCompleted, revision: expected + 1,
    revisionName: text(input.revisionName ?? before.revisionName, 'Revision name', 100) || 'Career profile', presentation: structure.presentation(input.presentation ?? before.presentation) };
  let saved;
  if (expected === 0) {
    try { saved = await Profile.create({ owner, ...update }); }
    catch (error) { if (error.code === 11000) throw fail('Profile changed elsewhere. Resolve your draft against the latest version.', 409); throw error; }
  } else saved = await Profile.findOneAndUpdate({ owner, revision: expected }, { $set: update,
    $push: { revisionHistory: { $each: [snapshot(before)], $slice: -30 } } }, { new: true, runValidators: true });
  if (!saved) throw fail('Profile changed elsewhere. Resolve your draft against the latest version.', 409);
  await User.updateOne({ _id: owner }, { $set: { targetRolePreference: targetRole } });
  return saved;
}
async function history(owner) {
  const profile = await Profile.findOne({ owner });
  return profile ? [...plain(profile.revisionHistory || []), { ...snapshot(profile), current: true }] : [];
}
async function restore(owner, input) {
  const entry = (await history(owner)).find((item) => item.revision === input.restoreRevision);
  if (!entry) throw fail('That revision is no longer available', 404);
  const { content, presentation, targetRole, experienceLevel, onboardingCompleted } = entry;
  return saveProfile(owner, { revision: input.revision, revisionName: 'Restored ' + (entry.name || 'revision ' + entry.revision), content, presentation, targetRole, experienceLevel, onboardingCompleted });
}
async function createResume(owner, input = {}) {
  const profile = await getProfile(owner);
  if (!profile.revision) throw fail('Save your career profile first');
  const content = cleanResumeContent(profile.content);
  if (!content.contactInfo.name || !content.skills.all.length && !content.workExperience.some((item) => item.company && item.role) && !content.projects.some((item) => item.title && item.description)) throw fail('Add your name and at least one skill, experience or project first');
  return Resume.create({ owner, title: text(input.title, 'Resume title', 120) || 'Career profile resume', parsedData: content, rawText: resumeText(content),
    presentation: profile.presentation, revisionName: 'Created from career profile', processingStatus: 'COMPLETED', sourceType: 'profile', verifiedAt: new Date(), contentRevision: 1, aiProvider: 'user-verified', atsScoreStale: true });
}
module.exports = { getProfile, saveProfile, createResume, history, restore };
