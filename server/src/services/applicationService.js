const Application = require('../models/Application');
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const stagesList = ['saved', 'applied', 'oa', 'interview', 'offer', 'rejected'];
function parseDate(value) {
  if (value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw fail('Provide a valid applied date');
  return date;
}
function weekStart(date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  return start.toISOString().slice(0, 10);
}
class ApplicationService {
  async listApplications(userId, { status, search, sort = '-lastUpdated' } = {}) {
    const query = { owner: userId };
    if (status && status !== 'all') query.status = status;
    if (search) {
      const literal = String(search).slice(0, 200).replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
      query.$or = [{ company: { $regex: literal, $options: 'i' } }, { roleTitle: { $regex: literal, $options: 'i' } }];
    }
    const allowedSort = ['-lastUpdated', 'lastUpdated', '-appliedDate', 'appliedDate', 'company', 'roleTitle'];
    return Application.find(query).sort(allowedSort.includes(sort) ? sort : '-lastUpdated');
  }
  async createApplication(userId, data) {
    const status = data.status || 'saved';
    if (!stagesList.includes(status)) throw fail('Invalid application status');
    const appliedDate = data.appliedDate !== undefined && data.appliedDate !== ''
      ? parseDate(data.appliedDate) : status === 'saved' ? null : new Date();
    return Application.create({ owner: userId, company: data.company, roleTitle: data.roleTitle,
      sourcePlatform: data.sourcePlatform || 'LinkedIn', jobLink: data.jobLink, status, appliedDate,
      salaryRange: data.salaryRange || '', location: data.location || '', notes: data.notes || '',
      timeline: [{ status, updatedAt: new Date(), note: 'Application added to pipeline' }] });
  }
  async updateApplication(appId, userId, data) {
    const app = await Application.findOne({ _id: appId, owner: userId });
    if (!app) throw fail('Application not found', 404);
    if (data.status && !stagesList.includes(data.status)) throw fail('Invalid application status');
    if (data.status && data.status !== app.status) {
      app.timeline.push({ status: data.status, updatedAt: new Date(), note: data.statusNote || 'Status updated to ' + data.status });
      app.status = data.status;
    }
    for (const key of ['company', 'roleTitle', 'sourcePlatform', 'jobLink', 'salaryRange', 'location', 'notes']) {
      if (data[key] !== undefined) app[key] = data[key];
    }
    if (data.appliedDate !== undefined) app.appliedDate = parseDate(data.appliedDate);
    if (app.status !== 'saved' && !app.appliedDate) app.appliedDate = new Date();
    app.lastUpdated = new Date();
    await app.save();
    return app;
  }
  async deleteApplication(appId, userId) {
    if (!await Application.findOneAndDelete({ _id: appId, owner: userId })) throw fail('Application not found', 404);
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
