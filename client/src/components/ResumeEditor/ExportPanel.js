import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
const defaults = { template: 'classic', font: 'sans', fontSize: 10.5, margin: 48, spacing: 2 };
export default function ExportPanel({ version, disabled }) {
  const userId = useAuthStore((state) => state.user?.id || state.user?._id);
  const [options, setOptions] = useState(defaults), [url, setUrl] = useState(''), [pages, setPages] = useState(0), [revision, setRevision] = useState(0), [error, setError] = useState(''), [working, setWorking] = useState(false);
  const currentUrl = useRef('');
  const identity = userId + ':' + version._id + ':' + (version.contentRevision || 1) + ':' + JSON.stringify(options);
  const latest = useRef(identity); latest.current = identity;
  useEffect(() => () => { if (currentUrl.current) URL.revokeObjectURL(currentUrl.current); }, []);
  useEffect(() => { setUrl(''); setPages(0); if (currentUrl.current) { URL.revokeObjectURL(currentUrl.current); currentUrl.current = ''; } }, [version.contentRevision, options, userId]);
  const base = '/resumes/' + version.resumeId + '/download/' + version._id;
  const current = () => userId === (useAuthStore.getState().user?.id || useAuthStore.getState().user?._id);
  const preview = async () => {
    setWorking(true); setError('');
    try {
      const response = await api.get(base + '?' + new URLSearchParams({ ...options, preview: '1' }), { responseType: 'blob' });
      if (!current() || latest.current !== identity) return;
      if (Number(response.headers['x-content-revision']) !== (version.contentRevision || 1)) { setError('This version changed elsewhere. Reload the latest saved content before previewing.'); return; }
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      setUrl(currentUrl.current); setPages(Number(response.headers['x-page-count'])); setRevision(Number(response.headers['x-content-revision']));
    } catch { if (current()) setError('Unable to generate a PDF preview. Your resume is still saved.'); }
    finally { if (current()) setWorking(false); }
  };
  const download = async (format) => {
    setWorking(true); setError('');
    try { await api.download(base + '?' + new URLSearchParams({ ...options, format }), 'resume_v' + version.version + '.' + format); }
    catch { if (current()) setError('Unable to export this resume. Please retry.'); }
    finally { if (current()) setWorking(false); }
  };
  const chooseTemplate = (template) => setOptions({ template, font: 'sans', fontSize: template === 'compact' ? 10 : template === 'modern' ? 11 : 10.5, margin: template === 'compact' ? 40 : 48, spacing: template === 'compact' ? 1 : template === 'modern' ? 3 : 2 });
  return <section className="brutal-card p-5 space-y-4"><h2 className="text-xl font-bold">Preview and export</h2><p className="text-sm">Save your edits before previewing. The preview is the actual PDF that these settings produce. All content flows onto as many pages as needed.</p>
    <fieldset disabled={working || disabled} className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <label className="text-sm font-semibold">Template<select className="brutal-input block w-full mt-1" value={options.template} onChange={(event) => chooseTemplate(event.target.value)}><option value="classic">Classic</option><option value="modern">Modern</option><option value="compact">Compact</option></select></label>
      <label className="text-sm font-semibold">Font<select className="brutal-input block w-full mt-1" value={options.font} onChange={(event) => setOptions({ ...options, font: event.target.value })}><option value="sans">Sans serif</option><option value="serif">Serif</option></select></label>
      {[['fontSize', 'Text size', [10, 10.5, 11, 11.5, 12]], ['margin', 'Margins', [36, 40, 48, 56, 64]], ['spacing', 'Line spacing', [1, 2, 3, 4]]].map(([key, label, choices]) => <label key={key} className="text-sm font-semibold">{label}<select className="brutal-input block w-full mt-1" value={options[key]} onChange={(event) => setOptions({ ...options, [key]: Number(event.target.value) })}>{choices.map((item) => <option key={item} value={item}>{item} pt</option>)}</select></label>)}
    </fieldset>
    <div className="flex flex-wrap gap-3"><button type="button" disabled={working || disabled} onClick={preview} className="brutal-btn-primary px-4 py-2 text-sm disabled:opacity-40">{working ? 'Preparing document…' : 'Preview PDF and page count'}</button>{['pdf', 'docx'].map((format) => <button type="button" key={format} disabled={working || disabled} onClick={() => download(format)} className="brutal-btn-yellow px-4 py-2 text-sm disabled:opacity-40">Download {format.toUpperCase()}</button>)}</div>
    {disabled && <p role="status" className="text-sm">Save the draft above to enable export.</p>}{error && <p role="alert">{error}</p>}
    {url && !disabled && <div className="space-y-3"><p role="status" className="text-sm font-semibold">{pages} {pages === 1 ? 'page' : 'pages'} · Saved edit revision {revision}</p><iframe title="Actual resume PDF preview" src={url} className="w-full h-[650px] border-2 bg-gray-100" /><a href={url} target="_blank" rel="noreferrer" className="text-sm underline">Open preview in a new tab</a></div>}
    <p className="text-sm text-gray-600">DOCX keeps the resume editable. Page breaks can vary between Word and other editors.</p>
  </section>;
}
