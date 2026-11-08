import React, { useState } from 'react';
import useOwnedResource from '../../hooks/useOwnedResource';
import api from '../../services/api';
export default function ApplicationReminders({ revision }) {
  const reminders = useOwnedResource('/applications/reminders?revision=' + revision);
  const [error, setError] = useState('');
  return <section className="brutal-card p-4 space-y-3"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold text-xl">Upcoming reminders</h2><button className="underline text-sm" onClick={() => api.download('/applications/calendar.ics', 'careerforge-applications.ics').catch(() => setError('Unable to export calendar. Please retry.'))}>Export calendar (.ics)</button></div><p className="text-xs">Deadlines, interviews and follow-ups due within seven days, including overdue items. Control reminders in each application.</p>{error && <p role="alert">{error}</p>}{reminders.error ? <p role="alert">{reminders.error}</p> : reminders.loading ? <p>Loading reminders…</p> : reminders.data?.length ? <ul className="space-y-2 text-sm">{reminders.data.map((item) => <li key={item.applicationId + item.kind}><a href={'/applications?application=' + item.applicationId} className="underline font-semibold">{item.title}</a> · {new Date(item.at).toLocaleString()}{item.overdue ? ' · Overdue' : ''}</li>)}</ul> : <p className="text-sm">No reminders due. Add dates to an application to get started.</p>}</section>;
}
