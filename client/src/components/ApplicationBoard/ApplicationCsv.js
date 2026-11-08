import React, { useState } from 'react';
import api from '../../services/api';
export default function ApplicationCsv({ onImported }) {
  const [csv, setCsv] = useState(''), [preview, setPreview] = useState(null), [selected, setSelected] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState('');
  async function load(event) {
    event.preventDefault(); setBusy(true); setError(''); setResult('');
    try { const response = await api.post('/applications/import/preview', { csv }); setPreview(response.data.data); setSelected(response.data.data.rows.filter((row) => !row.error && !row.duplicate).map((row) => row.row)); }
    catch (failure) { setError(failure.response?.data?.message || 'Unable to preview this CSV.'); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError('');
    try { const response = await api.post('/applications/import', { csv, rows: selected }); const data = response.data.data; setResult(data.imported.length + ' application(s) imported.' + (data.failed.length ? ' ' + data.failed.map((row) => 'Row ' + row.row + ': ' + row.error).join(' ') : '')); setPreview(null); setSelected([]); onImported?.(); }
    catch (failure) { setError(failure.response?.data?.message || 'Unable to import applications. Preview again before retrying.'); }
    finally { setBusy(false); }
  }
  return <details className="brutal-card p-4 space-y-3"><summary className="font-bold cursor-pointer">Import or export applications</summary><p className="text-sm">Export a CSV template, then add records using the same headings. Review and select rows before importing. Up to 200 rows or 1 MB; attachments and resume copies remain in the app.</p>
    <button type="button" className="underline text-sm" onClick={() => api.download('/applications/export.csv', 'careerforge-applications.csv').catch(() => setError('Unable to export applications.'))}>Export applications CSV</button>
    <form onSubmit={load} className="space-y-3"><label className="text-sm font-semibold block">Choose application CSV file<input type="file" accept=".csv,text/csv" className="block mt-1 max-w-full" disabled={busy} onChange={async (event) => { const file = event.target.files[0]; if (!file) return; setPreview(null); setResult(''); if (file.size > 1024 * 1024) { setError('Choose a CSV smaller than 1 MB.'); return; } try { setCsv(await file.text()); setError(''); } catch { setError('Unable to read this file.'); } }} /></label><label className="text-sm font-semibold block">Application CSV<textarea rows={5} maxLength={1024 * 1024} className="brutal-input block w-full mt-1" value={csv} placeholder={'company,roleTitle,status\nExample Co,Backend Engineer,saved'} onChange={(event) => { setCsv(event.target.value); setPreview(null); setResult(''); }} /></label><button disabled={busy || !csv.trim()} className="brutal-btn-primary px-4 py-2">{busy ? 'Working…' : 'Preview CSV import'}</button></form>
    {error && <p role="alert" className="text-sm">{error}</p>}{result && <p role="status">{result}</p>}
    {preview && <section aria-label="CSV import preview" className="space-y-3"><p className="text-sm">{preview.total} row(s), {preview.importable} ready to import. Existing applications and repeated rows are skipped.</p><ul className="space-y-2">{preview.rows.map((row) => <li key={row.row} className="border-2 p-3 text-sm"><label className="flex items-start gap-2"><input type="checkbox" aria-label={'Import row ' + row.row} checked={selected.includes(row.row)} disabled={busy || Boolean(row.error || row.duplicate)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.row] : selected.filter((number) => number !== row.row))} /><span>Row {row.row}: {row.values.roleTitle || '(missing role)'} at {row.values.company || '(missing company)'}</span></label>{row.error && <p>Error: {row.error}</p>}{row.duplicate && <p>Duplicate: {row.duplicate.label}</p>}</li>)}</ul><button type="button" disabled={busy || !selected.length} onClick={save} className="brutal-btn-primary px-4 py-2">Import selected applications</button></section>}
  </details>;
}
