import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { sectionLabels } from '../../services/resumeTools';
const defaults = { template: 'classic', font: 'sans', fontSize: 10.5, margin: 48, spacing: 2, pageBreakBefore: [], keepEntriesTogether: true };
const fromRecord = (record) => Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, record.exportSettings?.[key] ?? fallback]));
async function message(error, fallback) {
  let data = error.response?.data;
  if (data instanceof Blob) { try { data = JSON.parse(await data.text()); } catch { /* Keep the fallback message. */ } }
  return data?.message || error.message || fallback;
}
export default function ExportPanel({ version, disabled }) {
  const userId = useAuthStore((state) => state.user?.id || state.user?._id);
  const [options, setOptions] = useState(() => fromRecord(version)), [saved, setSaved] = useState(() => fromRecord(version)), [layoutRevision, setLayoutRevision] = useState(version.layoutRevision || 1);
  const [url, setUrl] = useState(''), [pages, setPages] = useState(0), [revision, setRevision] = useState(0), [error, setError] = useState(''), [working, setWorking] = useState(false), [savedMessage, setSavedMessage] = useState('');
  const currentUrl = useRef(''), identity = userId + ':' + version._id + ':' + (version.contentRevision || 1) + ':' + JSON.stringify(options);
  const latest = useRef(identity); latest.current = identity;
  useEffect(() => () => { if (currentUrl.current) URL.revokeObjectURL(currentUrl.current); }, []);
  useEffect(() => { setUrl(''); setPages(0); if (currentUrl.current) { URL.revokeObjectURL(currentUrl.current); currentUrl.current = ''; } }, [version.contentRevision, options, userId]);
  const base = '/resumes/' + version.resumeId + '/download/' + version._id, current = () => userId === (useAuthStore.getState().user?.id || useAuthStore.getState().user?._id);
  const query = (extra) => new URLSearchParams({ ...options, pageBreakBefore: options.pageBreakBefore.join(','), ...extra });
  const preview = async () => {
    setWorking(true); setError('');
    try {
      const response = await api.get(base + '?' + query({ preview: '1' }), { responseType: 'blob' });
      if (!current() || latest.current !== identity) return;
      if (Number(response.headers['x-content-revision']) !== (version.contentRevision || 1)) { setError('This version changed elsewhere. Reload the latest saved content before previewing.'); return; }
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' })); setUrl(currentUrl.current); setPages(Number(response.headers['x-page-count'])); setRevision(Number(response.headers['x-content-revision']));
    } catch (failure) { const text = await message(failure, 'Unable to generate a PDF preview. Your resume is still saved.'); if (current()) setError(text); }
    finally { if (current()) setWorking(false); }
  };
  const download = async (format) => {
    setWorking(true); setError('');
    try { await api.download(base + '?' + query({ format }), 'resume_v' + version.version + '.' + format, { expectedRevision: version.contentRevision || 1 }); }
    catch (failure) { const text = await message(failure, 'Unable to export this resume. Please retry.'); if (current()) setError(text); }
    finally { if (current()) setWorking(false); }
  };
  async function saveLayout() {
    setWorking(true); setError('');
    try { const res = await api.put('/resumes/' + version.resumeId + '/versions/' + version._id + '/layout', { revision: layoutRevision, settings: options }); if (!current()) return; const value = fromRecord(res.data.data); setOptions(value); setSaved(value); setLayoutRevision(res.data.data.layoutRevision); setSavedMessage('Layout preferences saved for this version.'); }
    catch (failure) { if (current()) setError(failure.response?.data?.message || 'Unable to save layout settings.'); }
    finally { if (current()) setWorking(false); }
  }
  const chooseTemplate = (template) => setOptions({ ...options, template, font: 'sans', fontSize: template === 'compact' ? 10 : template === 'modern' ? 11 : 10.5, margin: template === 'compact' ? 40 : 48, spacing: template === 'compact' ? 1 : template === 'modern' ? 3 : 2 });
  return <section className="brutal-card p-5 space-y-4"><h2 className="text-xl font-bold">Preview and export</h2><p className="text-sm">The preview is the actual PDF produced by these settings. Save layout preferences to reuse them when you return to this version.</p>
    <fieldset disabled={working || disabled} className="space-y-4"><legend className="font-semibold text-sm mb-2">Layout settings</legend><div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <label className="text-sm font-semibold">Template<select className="brutal-input block w-full mt-1" value={options.template} onChange={(event) => chooseTemplate(event.target.value)}><option value="classic">Classic</option><option value="modern">Modern</option><option value="compact">Compact</option></select></label>
      <label className="text-sm font-semibold">Font<select className="brutal-input block w-full mt-1" value={options.font} onChange={(event) => setOptions({ ...options, font: event.target.value })}><option value="sans">Sans serif</option><option value="serif">Serif</option></select></label>
      {[['fontSize', 'Text size', [10, 10.5, 11, 11.5, 12]], ['margin', 'Margins', [36, 40, 48, 56, 64]], ['spacing', 'Line spacing', [1, 2, 3, 4]]].map(([key, label, choices]) => <label key={key} className="text-sm font-semibold">{label}<select className="brutal-input block w-full mt-1" value={options[key]} onChange={(event) => setOptions({ ...options, [key]: Number(event.target.value) })}>{choices.map((item) => <option key={item} value={item}>{item} pt</option>)}</select></label>)}</div>
      <label className="block text-sm"><input type="checkbox" checked={options.keepEntriesTogether} onChange={(event) => setOptions({ ...options, keepEntriesTogether: event.target.checked })} /> Keep each experience or project together when it fits on one page</label>
      <fieldset className="border-2 p-3"><legend className="px-2 font-semibold text-sm">Start sections on a new page</legend><div className="flex flex-wrap gap-4">{Object.entries(sectionLabels).map(([key, label]) => <label key={key} className="text-sm"><input type="checkbox" checked={options.pageBreakBefore.includes(key)} onChange={(event) => setOptions({ ...options, pageBreakBefore: event.target.checked ? [...options.pageBreakBefore, key] : options.pageBreakBefore.filter((item) => item !== key) })} /> {label}</label>)}</div></fieldset>
      <button type="button" disabled={JSON.stringify(options) === JSON.stringify(saved)} onClick={saveLayout} className="border-2 px-4 py-2 text-sm disabled:opacity-40">Save layout for this version</button>
    </fieldset>
    {savedMessage && <p role="status" className="text-sm">{savedMessage}</p>}
    <div className="flex flex-wrap gap-3"><button type="button" disabled={working || disabled} onClick={preview} className="brutal-btn-primary px-4 py-2 text-sm disabled:opacity-40">{working ? 'Preparing document…' : 'Preview PDF and page count'}</button>{['pdf', 'docx'].map((format) => <button type="button" key={format} disabled={working || disabled} onClick={() => download(format)} className="brutal-btn-yellow px-4 py-2 text-sm disabled:opacity-40">Download {format.toUpperCase()}</button>)}</div>
    {disabled && <p role="status" className="text-sm">Save the draft above to enable export.</p>}{error && <p role="alert">{error}</p>}
    {url && !disabled && <div className="space-y-3"><p role="status" className="text-sm font-semibold">{pages} {pages === 1 ? 'page' : 'pages'} · Saved edit revision {revision}</p><iframe title="Actual resume PDF preview" src={url} className="w-full h-[650px] border-2 bg-gray-100" /><a href={url} target="_blank" rel="noreferrer" className="text-sm underline">Open preview in a new tab</a></div>}
    <p className="text-sm text-gray-600">PDFs embed Unicode fonts for Latin, Greek, Cyrillic, Devanagari and CJK text. DOCX stays editable; fonts and page breaks can vary between editors.</p>
  </section>;
}
