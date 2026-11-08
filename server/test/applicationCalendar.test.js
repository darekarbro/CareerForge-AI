const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calendar } = require('../src/services/applicationCalendar');
test('calendar exports dates, UTC interview times, stable IDs, opt-in alarms, escaped and folded unicode', () => {
  const app = { _id: 'abc', company: 'Acme, Inc\nTest', roleTitle: 'Engineer ' + '語'.repeat(100), deadline: '2026-11-09', interviewAt: '2026-11-08T14:00:00+05:30', followUpAt: '2026-11-10', revision: 3, notificationPreferences: { calendarAlarm: false } };
  const plain = calendar([app]);
  assert.match(plain, /DTSTART;VALUE=DATE:20261109/);
  assert.match(plain, /DTSTART:20261108T083000Z/);
  assert.match(plain, /UID:abc-interviewAt@careerforge.local/);
  assert.match(plain, /SEQUENCE:2/);
  assert(!plain.includes('VALARM'));
  assert(plain.split('\r\n').every((line) => Buffer.byteLength(line) <= 75));
  const unfolded = plain.replace(/\r\n /g, '');
  assert(unfolded.includes('Acme\\, Inc\\nTest'));
  app.notificationPreferences = { calendarAlarm: true, leadMinutes: 15 };
  assert.match(calendar([app]), /TRIGGER:-PT15M/);
});
