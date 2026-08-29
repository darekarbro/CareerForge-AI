const Application = require('../models/Application');

class ApplicationService {
  async listApplications(userId, { status, search, sort = '-lastUpdated' } = {}) {
    const query = { owner: userId };
    if (status && status !== 'all') {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { company: { $regex: search, $options: 'i' } },
        { roleTitle: { $regex: search, $options: 'i' } },
      ];
    }
    return Application.find(query).sort(sort);
  }

  async createApplication(userId, data) {
    return Application.create({
      owner: userId,
      company: data.company,
      roleTitle: data.roleTitle,
      sourcePlatform: data.sourcePlatform || 'LinkedIn',
      jobLink: data.jobLink,
      status: data.status || 'saved',
      appliedDate: data.appliedDate || new Date(),
      salaryRange: data.salaryRange || '',
      location: data.location || '',
      notes: data.notes || '',
      timeline: [
        {
          status: data.status || 'saved',
          updatedAt: new Date(),
          note: 'Application added to pipeline',
        },
      ],
    });
  }

  async updateApplication(appId, userId, data) {
    const app = await Application.findOne({ _id: appId, owner: userId });
    if (!app) {
      const error = new Error('Application not found');
      error.statusCode = 404;
      throw error;
    }

    if (data.status && data.status !== app.status) {
      app.timeline.push({
        status: data.status,
        updatedAt: new Date(),
        note: data.statusNote || `Status updated to ${data.status}`,
      });
      app.status = data.status;
    }

    if (data.company) app.company = data.company;
    if (data.roleTitle) app.roleTitle = data.roleTitle;
    if (data.sourcePlatform) app.sourcePlatform = data.sourcePlatform;
    if (data.jobLink !== undefined) app.jobLink = data.jobLink;
    if (data.salaryRange !== undefined) app.salaryRange = data.salaryRange;
    if (data.location !== undefined) app.location = data.location;
    if (data.notes !== undefined) app.notes = data.notes;
    app.lastUpdated = new Date();

    await app.save();
    return app;
  }

  async deleteApplication(appId, userId) {
    const app = await Application.findOneAndDelete({ _id: appId, owner: userId });
    if (!app) {
      const error = new Error('Application not found');
      error.statusCode = 404;
      throw error;
    }
    return { success: true, message: 'Application removed' };
  }

  async getAnalytics(userId) {
    const apps = await Application.find({ owner: userId }).sort({ appliedDate: 1 });

    const total = apps.length;
    const stages = {
      saved: apps.filter(a => a.status === 'saved').length,
      applied: apps.filter(a => a.status === 'applied').length,
      oa: apps.filter(a => a.status === 'oa').length,
      interview: apps.filter(a => a.status === 'interview').length,
      offer: apps.filter(a => a.status === 'offer').length,
      rejected: apps.filter(a => a.status === 'rejected').length,
    };

    // Calculate funnel conversion percentages
    const appliedOrBeyond = total - stages.saved;
    const oaOrBeyond = stages.oa + stages.interview + stages.offer;
    const interviewOrBeyond = stages.interview + stages.offer;
    const offers = stages.offer;

    const conversionRates = {
      appliedToOa: appliedOrBeyond > 0 ? Math.round((oaOrBeyond / appliedOrBeyond) * 100) : 0,
      oaToInterview: oaOrBeyond > 0 ? Math.round((interviewOrBeyond / oaOrBeyond) * 100) : 0,
      interviewToOffer: interviewOrBeyond > 0 ? Math.round((offers / interviewOrBeyond) * 100) : 0,
      overallConversion: total > 0 ? Math.round((offers / total) * 100) : 0,
    };

    // Applications volume grouped by week
    const weeklyBuckets = {};
    apps.forEach(a => {
      const d = new Date(a.appliedDate || a.createdAt);
      const weekKey = `${d.getFullYear()}-W${Math.ceil(d.getDate() / 7)}`;
      weeklyBuckets[weekKey] = (weeklyBuckets[weekKey] || 0) + 1;
    });

    const weeklyVolume = Object.entries(weeklyBuckets).map(([week, count]) => ({
      week,
      applications: count,
    }));

    return {
      totalApplications: total,
      stages,
      conversionRates,
      weeklyVolume,
    };
  }
}

module.exports = new ApplicationService();
