const { withEntryIds } = require('./resumeStructure');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function changes(version) {
  const source = withEntryIds(version.sourceContent || {}), target = withEntryIds(version.tailoredContent || {}), result = [];
  const add = (label, before, after, path, key) => {
    if (equal(before, after)) return;
    const detail = (version.diffFromOriginal?.modifiedHighlights || []).find((item) => item.original === before && item.tailored === after);
    const reason = detail?.reason || (path[0] === 'skills' ? 'Prioritizes skills already present in your source for this target role.' : path[0] === 'summary' ? 'Refocuses the summary on ' + version.targetRole + ' using your existing experience.' : 'Clarifies the contribution and highlights relevant detail for ' + version.targetRole + '. Check the wording against your source facts.');
    result.push({ key, label, before, after, path, reason });
  };
  add('Professional summary', source.summary || '', target.summary || '', ['summary'], 'summary');
  for (const section of ['workExperience', 'projects']) (target[section] || []).forEach((entry, index) => {
    const original = (source[section] || []).find((item) => item.entryId === entry.entryId) || source[section]?.[index] || {};
    const label = entry.title || [entry.role, entry.company].filter(Boolean).join(' at ') || section;
    const key = 'r_' + section + '_' + entry.entryId;
    if (section === 'projects') add(label + ' — description', original.description || '', entry.description || '', [section, index, 'description'], key + '_description');
    const before = original.highlights || [], after = entry.highlights || [];
    if (equal([...before].sort(), [...after].sort())) add(label + ' — bullet order', before, after, [section, index, 'highlights'], key + '_order');
    else after.forEach((line, number) => add(label + ' — achievement ' + (number + 1), before[number] || '', line, [section, index, 'highlights', number], key + '_bullet_' + number));
  });
  for (const group of ['technical', 'frameworks', 'tools', 'soft']) add(group + ' skills', source.skills?.[group] || [], target.skills?.[group] || [], ['skills', group], 'r_skills_' + group);
  return result;
}
function progress(version) {
  const items = changes(version), decisions = version.reviewDecisions || {};
  const reviewed = items.filter((item, index) => ['accepted', 'rejected', 'edited'].includes(decisions[item.key] || decisions[String(index)])).length;
  return { total: items.length, reviewed, complete: items.length === reviewed };
}
module.exports = { changes, progress };
