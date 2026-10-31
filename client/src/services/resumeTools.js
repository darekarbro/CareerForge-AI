export const sectionLabels = { summary: 'Summary', skills: 'Skills', workExperience: 'Experience', projects: 'Projects', education: 'Education', certifications: 'Certificates' };
export const entrySections = ['workExperience', 'projects', 'education', 'certifications'];
export const defaultPresentation = () => ({ sectionOrder: Object.keys(sectionLabels) });
export const entryId = (entry, section, index) => entry.entryId || String(entry._id || 'legacy-' + section + '-' + index);
export const newEntryId = () => globalThis.crypto?.randomUUID?.() || 'entry-' + Date.now() + '-' + Math.random().toString(36).slice(2);
export const copy = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const keys = (...values) => [...new Set(values.flatMap((value) => Object.keys(object(value) ? value : {})))].filter((key) => !['__proto__', 'constructor', 'prototype', '_id', 'entryId'].includes(key));
const norm = (value) => String(value || '').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
export function duplicateEntries(content) {
  const issues = [];
  for (const section of entrySections) {
    const seen = new Map();
    (content[section] || []).forEach((entry, index) => {
      const identity = section === 'workExperience' ? [entry.role, entry.company, entry.startDate] : section === 'projects' ? [entry.title] : section === 'education' ? [entry.degree, entry.institution, entry.graduationYear] : [entry.name, entry.issuer, entry.year];
      if (!identity.some(Boolean)) return;
      const key = identity.map(norm).join('|');
      if (seen.has(key)) issues.push({ section, index, duplicateOf: seen.get(key), message: sectionLabels[section] + ' ' + (index + 1) + ' may duplicate entry ' + (seen.get(key) + 1) + '. Review both before removing either.' });
      else seen.set(key, index);
    });
  }
  return issues;
}
export function dateIssue(entry) {
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const point = (value, end) => {
    if (!value || /^(present|current|now)$/i.test(value)) return null;
    const iso = value.match(/^(\d{4})(?:-(\d{2}))?$/), named = value.match(/^([a-z]+)\s+(\d{4})$/i);
    const year = Number(iso?.[1] || named?.[2]), month = iso ? Number(iso[2] || (end ? 12 : 1)) : named ? months.indexOf(named[1].slice(0, 3).toLowerCase()) + 1 : 0;
    return year >= 1900 && year <= new Date().getUTCFullYear() + 15 && month >= 1 && month <= 12 ? year * 12 + month : NaN;
  };
  const start = point(entry.startDate, false), end = entry.current ? null : point(entry.endDate, true);
  if (Number.isNaN(start) || Number.isNaN(end)) return 'Use YYYY, YYYY-MM or Month YYYY for dates.';
  if (start && end && start > end) return 'The start date must be before the end date.';
  return '';
}
function encode(value, path = []) {
  if (Array.isArray(value)) {
    if (path.includes('content') && entrySections.includes(path.at(-1))) return { $entries: true, order: value.map((entry, index) => entryId(entry, path.at(-1), index)), items: Object.fromEntries(value.map((entry, index) => [entryId(entry, path.at(-1), index), encode(entry, [...path, index])])) };
    return copy(value);
  }
  return object(value) ? Object.fromEntries(keys(value).map((key) => [key, encode(value[key], [...path, key])])) : value;
}
function decode(value) {
  if (value?.$entries) {
    const order = [...new Set([...value.order, ...Object.keys(value.items)])];
    return order.filter((id) => value.items[id] !== undefined).map((id) => ({ ...decode(value.items[id]), entryId: id }));
  }
  return object(value) ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)])) : copy(value);
}
export function fieldLabel(path, trees = []) {
  const labels = [], cursor = [];
  for (let index = 0; index < path.length; index++) {
    const key = path[index]; cursor.push(key);
    if (key === 'content' || key === '$entries') continue;
    if (key === 'items') {
      const id = path[++index]; cursor.push(id);
      const entry = trees.map((tree) => cursor.reduce((item, part) => item?.[part], tree)).find(Boolean);
      labels.push(entry?.title || entry?.role || entry?.name || entry?.degree || 'Entry'); continue;
    }
    labels.push(sectionLabels[key] || (key === 'order' ? 'Entry order' : key.replace(/([a-z])([A-Z])/g, '$1 $2')));
  }
  return labels.join(' / ');
}
function orderLabel(value, path, trees) {
  if (path.at(-1) !== 'order' || !Array.isArray(value)) return undefined;
  const containers = trees.map((tree) => path.slice(0, -1).reduce((item, key) => item?.[key], tree));
  return value.map((id) => { const item = containers.map((container) => container?.items?.[id]).find(Boolean); return item?.title || item?.role || item?.name || item?.degree || 'Entry'; }).join(' → ');
}
export function mergePlan(base, mine, theirs) {
  const trees = [encode(base), encode(mine), encode(theirs)], conflicts = [];
  function merge(before, local, remote, path = []) {
    if (equal(local, remote)) return copy(remote);
    if (equal(local, before)) return copy(remote);
    if (equal(remote, before)) return copy(local);
    if (object(local) && object(remote)) return Object.fromEntries(keys(before, local, remote).map((key) => [key, key === '$entries' ? true : merge(before?.[key], local[key], remote[key], [...path, key])]));
    if (path.at(-1) === 'order' && [before, local, remote].every(Array.isArray)) {
      const common = before.filter((id) => local.includes(id) && remote.includes(id)), a = local.filter((id) => common.includes(id)), b = remote.filter((id) => common.includes(id));
      if (equal(a, common) || equal(a, b)) return [...new Set([...remote, ...local])];
      if (equal(b, common)) return [...new Set([...local, ...remote])];
    }
    conflicts.push({ path, before, mine: copy(local), theirs: copy(remote), label: fieldLabel(path, trees), mineLabel: orderLabel(local, path, trees), theirsLabel: orderLabel(remote, path, trees) });
    return copy(remote);
  }
  return { encoded: merge(...trees), conflicts };
}
export function resolvePlan(plan, choices) {
  const value = copy(plan.encoded);
  plan.conflicts.forEach((conflict, index) => {
    const selected = choices[index] === 'mine' ? conflict.mine : conflict.theirs;
    let parent = value;
    conflict.path.slice(0, -1).forEach((key) => { parent = parent[key]; });
    const key = conflict.path.at(-1); if (selected === undefined) delete parent[key]; else parent[key] = copy(selected);
  });
  return decode(value);
}
export function revisionDiff(before, after) {
  const trees = [encode(before), encode(after)], changes = [];
  const visit = (a, b, path = []) => {
    if (equal(a, b)) return;
    if (object(a) && object(b)) { for (const key of keys(a, b)) if (key !== '$entries') visit(a[key], b[key], [...path, key]); }
    else changes.push({ path, label: fieldLabel(path, trees), before: a, after: b, beforeLabel: orderLabel(a, path, trees), afterLabel: orderLabel(b, path, trees) });
  };
  visit(...trees); return changes;
}
export const displayValue = (value) => value === undefined ? 'Removed' : Array.isArray(value) ? value.map((item) => typeof item === 'object' ? JSON.stringify(item) : item).join('\n') : typeof value === 'object' ? JSON.stringify(value, null, 2) : value === '' || value === null ? 'Empty' : String(value);
