const Application = require('../models/Application');
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const stagesList = ['saved', 'applied', 'oa', 'interview', 'offer', 'rejected'];
function parseDate(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) throw fail('Provide an ISO date or date-time');
  const [year, month, day] = value.slice(0, 10).split('-').map(Number), calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) throw fail('Provide a valid calendar date');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw fail('Provide a valid date');
  return date;
}
function weekStart(date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  return start.toISOString().slice(0, 10);
}
class ApplicationService {
  async syncWorkspace(application, owner) {
    const Workspace = require('../models/JobWorkspace');
    await Workspace.updateMany({ owner, applicationId: application._id, ...(application.workspaceId ? { _id: { $ne: application.workspaceId } } : {}) }, { $unset: { applicationId: 1 } });
    if (application.workspaceId) await Workspace.updateOne({ _id: application.workspaceId, owner }, { $set: { applicationId: application._id } });
  }
  async validateLinks(userId, data, before) {
    const extra = {};
    if (data.workspaceId) { await require('./workspaceService').get(data.workspaceId, userId); extra.workspaceId = data.workspaceId; }
    else if (data.workspaceId === '') extra.workspaceId = null;
    if (data.resumeVersionId && String(before?.resumeVersionId || '') !== String(data.resumeVersionId)) {
      const version = await require('./tailoringService').getTailoredVersion(data.resumeVersionId, userId);
      await require('./resumeService').getReadyResume(version.resumeId, userId);
      extra.resumeVersionId = version._id;
      extra.resumeSnapshot = { content: require('../providers/resumeFacts').plain(version.reviewedContent || version.tailoredContent),
        version: version.version, contentRevision: version.contentRevision || 1, resumeId: version.resumeId, capturedAt: new Date() };
    } else if (data.resumeVersionId === '') { extra.resumeVersionId = null; extra.resumeSnapshot = null; }
    for (const field of ['deadline', 'followUpAt']) if (data[field] !== undefined) extra[field] = parseDate(data[field]);
    const allowed = ['company', 'roleTitle', 'sourcePlatform', 'jobLink', 'status', 'salaryRange', 'location', 'notes', 'appliedDate', 'deadline', 'followUpAt', 'workspaceId', 'resumeVersionId', 'revision', 'statusNote'];
    if (Object.keys(data).some((key) => !allowed.includes(key))) throw fail('Unsupported application field');
    for (const field of ['company', 'roleTitle', 'salaryRange', 'location', 'notes', 'statusNote']) if (data[field] !== undefined) require('./resumeContent').text(data[field], field, field === 'notes' ? 10000 : 300);
    if (data.jobLink !== undefined) extra.jobLink = require('./resumeContent').url(data.jobLink, 'Job link');
    return extra;
  }
  async listApplications(userId, { status, search, sort = '-lastUpdated', due } = {}) {
    const query = { owner: userId };
    if (status && status !== 'all') query.status = status;
    if (search) {
      const literal = String(search).slice(0, 200).replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
      query.$or = [{ company: { $regex: literal, $options: 'i' } }, { roleTitle: { $regex: literal, $options: 'i' } }];
    }
    if (due === '1') query.$and = [{ status: { $nin: ['offer', 'rejected'] } }, { $or: [{ deadline: { $ne: null, $lte: new Date(Date.now() + 7 * 86400000) } }, { followUpAt: { $ne: null, $lte: new Date(Date.now() + 7 * 86400000) } }] }];
    const allowedSort = ['-lastUpdated', 'lastUpdated', '-appliedDate', 'appliedDate', 'company', 'roleTitle', 'deadline', 'followUpAt'];
    return Application.find(query).sort(allowedSort.includes(sort) ? sort : '-lastUpdated');
  }
  async createApplication(userId, data) {
    const extra = await this.validateLinks(userId, data);
    const status = data.status || 'saved';
    if (!stagesList.includes(status)) throw fail('Invalid application status');
    const appliedDate = data.appliedDate !== undefined && data.appliedDate !== ''
      ? parseDate(data.appliedDate) : status === 'saved' ? null : new Date();
    const created = await Application.create({ owner: userId, ...extra, company: data.company, roleTitle: data.roleTitle,
      sourcePlatform: data.sourcePlatform || 'LinkedIn', jobLink: extra.jobLink, status, appliedDate,
      salaryRange: data.salaryRange || '', location: data.location || '', notes: data.notes || '',
      timeline: [{ status, updatedAt: new Date(), note: 'Application added to pipeline' }] });
    await this.syncWorkspace(created, userId);
    return created;
  }
  async updateApplication(appId, userId, data) {
    const app = await Application.findOne({ _id: appId, owner: userId });
    if (!app) throw fail('Application not found', 404);
    if (data.revision !== undefined && data.revision !== (app.revision || 1)) throw fail('This application changed elsewhere. Reload before saving.', 409);
    const extra = await this.validateLinks(userId, data, app); Object.assign(app, extra);
    if (data.status && !stagesList.includes(data.status)) throw fail('Invalid application status');
    if (data.status && data.status !== app.status) {
      app.timeline.push({ status: data.status, updatedAt: new Date(), note: data.statusNote || 'Status updated to ' + data.status });
      app.status = data.status;
    }
    for (const key of ['company', 'roleTitle', 'sourcePlatform', 'salaryRange', 'location', 'notes']) {
      if (data[key] !== undefined) app[key] = data[key];
    }
    if (data.appliedDate !== undefined) app.appliedDate = parseDate(data.appliedDate);
    if (app.status !== 'saved' && !app.appliedDate) app.appliedDate = new Date();
    app.lastUpdated = new Date();
    app.revision = (app.revision || 1) + 1;
    try { await app.save(); } catch (error) { if (error.name === 'VersionError') throw fail('This application changed elsewhere. Reload before saving.', 409); throw error; }
    await this.syncWorkspace(app, userId);
    return app;
  }
  async deleteApplication(appId, userId) {
    if (!await Application.findOneAndDelete({ _id: appId, owner: userId })) throw fail('Application not found', 404);
    await require('../models/JobWorkspace').updateMany({ owner: userId, applicationId: appId }, { $unset: { applicationId: 1 } });
    return { success: true, message: 'Application removed' };
  }
  async getAnalytics(userId) {
    const apps = await Application.find({ owner: userId });
    const stages = Object.fromEntries(stagesList.map((stage) => [stage, apps.filter((app) => app.status === stage).length]));
    const rank = ['saved', 'applied', 'oa', 'interview', 'offer'];
    const reached = apps.map((app) => {
      const visited = [...app.timeline.map((event) => event.status), app.status];
      // Funnel stages are cumulative: reaching a later stage implies passing the earlier thresholds.
      return Math.max(app.appliedDate && app.status !== 'saved' ? 1 : 0, ...visited.map((stage) => rank.indexOf(stage)));
    });
    const count = (minimum) => reached.filter((value) => value >= minimum).length;
    const percent = (numerator, denominator) => denominator ? Math.round(numerator / denominator * 100) : 0;
    const buckets = new Map();
    apps.filter((app) => app.appliedDate).forEach((app) => {
      const key = weekStart(app.appliedDate);
      buckets.set(key, (buckets.get(key) || 0) + 1);
    });
    return {
      totalApplications: apps.length, stages,
      conversionRates: { appliedToOa: percent(count(2), count(1)), oaToInterview: percent(count(3), count(2)),
        interviewToOffer: percent(count(4), count(3)), overallConversion: percent(count(4), apps.length) },
      weeklyVolume: [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, applications]) => ({ week, applications })),
    };
  }
}
module.exports = new ApplicationService();
module.exports.weekStart = weekStart;
