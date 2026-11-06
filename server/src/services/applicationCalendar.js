const fields = { deadline: 'Application deadline', interviewAt: 'Interview', followUpAt: 'Follow up' };
const escape = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const stamp = (value) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
// RFC 5545 requires CRLF and folding at 75 octets, including continuation spaces.
function fold(line) {
  const lines = []; let part = '', bytes = 0;
  for (const char of line) {
    const count = Buffer.byteLength(char);
    if (bytes + count > 75) { lines.push(part); part = ' '; bytes = 1; }
    part += char; bytes += count;
  }
  lines.push(part); return lines.join('\r\n');
}
function events(app) {
  return Object.entries(fields).filter(([key]) => app[key]).map(([key, label]) => ({
    applicationId: String(app._id), kind: key, title: label + ': ' + app.roleTitle + ' at ' + app.company,
    at: app[key], leadMinutes: app.notificationPreferences?.leadMinutes ?? 60,
    inApp: app.notificationPreferences?.inApp !== false, calendarAlarm: app.notificationPreferences?.calendarAlarm === true,
  }));
}
function calendar(apps) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CareerForge//Applications//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const app of apps) for (const event of events(app)) {
    const dateOnly = event.kind !== 'interviewAt' && new Date(event.at).toISOString().endsWith('T00:00:00.000Z');
    lines.push('BEGIN:VEVENT', 'UID:' + app._id + '-' + event.kind + '@careerforge.local', 'DTSTAMP:' + stamp(app.lastUpdated || app.updatedAt || app.createdAt || new Date()),
      'SEQUENCE:' + ((app.revision || 1) - 1), 'SUMMARY:' + escape(event.title),
      dateOnly ? 'DTSTART;VALUE=DATE:' + stamp(event.at).slice(0, 8) : 'DTSTART:' + stamp(event.at),
      dateOnly ? 'DTEND;VALUE=DATE:' + stamp(new Date(new Date(event.at).getTime() + 86400000)).slice(0, 8) : 'DTEND:' + stamp(new Date(new Date(event.at).getTime() + 3600000)),
      'DESCRIPTION:' + escape([app.jobLink, app.notes].filter(Boolean).join('\n')));
    if (event.calendarAlarm) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escape(event.title), 'TRIGGER:-PT' + event.leadMinutes + 'M', 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR'); return lines.map(fold).join('\r\n') + '\r\n';
}
async function reminders(owner) {
  const apps = await require('../models/Application').find({ owner, status: { $nin: ['offer', 'rejected'] }, 'notificationPreferences.inApp': { $ne: false } });
  const now = Date.now(), horizon = now + 7 * 86400000;
  return apps.flatMap(events).filter((event) => event.inApp && new Date(event.at).getTime() - event.leadMinutes * 60000 <= horizon)
    .map((event) => ({ ...event, overdue: new Date(event.at).getTime() < now })).sort((a, b) => new Date(a.at) - new Date(b.at));
}
module.exports = { calendar, reminders, events, fold };
