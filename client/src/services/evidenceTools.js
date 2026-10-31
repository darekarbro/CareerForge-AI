import { normalizeContent } from '../components/ResumeEditor/ResumeEditor';
export function evidenceContexts(resumes = [], profile) {
  const result = new Map();
  for (const item of [...resumes.map((resume) => ({ id: resume._id, title: resume.title, content: resume.parsedData })), ...(profile?._id ? [{ id: profile._id, title: 'Career profile', content: profile.content }] : [])]) {
    const content = normalizeContent(item.content);
    for (const section of ['workExperience', 'projects']) for (const entry of content[section]) {
      const context = { section, entryId: entry.entryId, recordId: item.id }, value = contextValue(context);
      if (!result.has(value)) result.set(value, { value, context, label: (entry.title || [entry.role, entry.company].filter(Boolean).join(' at ') || 'Untitled entry') + ' · ' + item.title });
    }
  }
  return [...result.values()];
}
export const contextValue = (value) => value?.entryId ? value.section + ':' + value.entryId + ':' + value.recordId : '';
export const decodeContext = (value) => { if (!value) return {}; const [section, entryId, recordId] = value.split(':'); return { section, entryId, recordId }; };
export const emptyEvidence = () => ({ kind: 'achievement', title: '', statement: '', technologies: [], context: {}, verification: 'unverified', measurement: 'unknown', measurementNotes: '' });
export function evidenceInput(item) { return { ...Object.fromEntries(Object.keys(emptyEvidence()).map((key) => [key, item[key] ?? emptyEvidence()[key]])), ...(item._id ? { revision: item.revision } : {}) }; }
