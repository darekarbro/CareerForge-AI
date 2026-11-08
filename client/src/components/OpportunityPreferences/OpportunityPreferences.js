import React, { useState } from 'react';
import api from '../../services/api';
const split = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);
export default function OpportunityPreferences({ preferences, onSaved }) {
  const [value, setValue] = useState(preferences), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [fields, setFields] = useState(Object.fromEntries(['roles', 'locations', 'avoidCompanies'].map((key) => [key, (preferences[key] || []).join(', ')])));
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.put('/workspaces/preferences', { revision: value.revision, ...Object.fromEntries(Object.entries(fields).map(([key, text]) => [key, split(text)])), workModes: value.workModes || [] }); await onSaved(); }
    catch (failure) { setError(failure.response?.data?.message || 'Unable to save preferences.'); }
    finally { setBusy(false); }
  }
  return <details className="brutal-card p-5"><summary className="font-bold cursor-pointer">Opportunity preferences</summary><p className="text-sm my-3">Choose what matters to you. Ranking compares these preferences with saved job text and career evidence.</p><form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
    {[['roles', 'Preferred roles'], ['locations', 'Preferred locations'], ['avoidCompanies', 'Companies to deprioritize']].map(([key, label]) => <label key={key} className="text-sm font-semibold">{label}<input className="brutal-input block w-full mt-1" value={fields[key]} maxLength={2400} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} /><span className="text-xs font-normal">Separate values with commas.</span></label>)}
    <fieldset><legend className="text-sm font-semibold">Preferred work arrangements</legend>{['remote', 'hybrid', 'onsite'].map((mode) => <label className="block text-sm mt-2" key={mode}><input type="checkbox" checked={(value.workModes || []).includes(mode)} onChange={(event) => setValue({ ...value, workModes: event.target.checked ? [...(value.workModes || []), mode] : value.workModes.filter((item) => item !== mode) })} /> {mode}</label>)}</fieldset>
    {error && <p role="alert">{error}</p>}<button disabled={busy} className="brutal-btn-primary px-4 py-2">{busy ? 'Saving…' : 'Save opportunity preferences'}</button>
  </form></details>;
}
