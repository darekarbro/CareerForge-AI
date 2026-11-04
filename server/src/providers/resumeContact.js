const { instruction } = require('../services/jobRequirements');

const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const title = /^(?:resume|curriculum vitae|cv)$/i;
const contactLabel = /^(?:e-?mail|phone|tel(?:ephone)?|mobile|location|address|linkedin|github|portfolio)\s*:/i;
const url = /^(?:https?:\/\/|www\.)\S+$/i;
const phone = /^\+?[\d ().-]+$/;

function validName(value) {
  return value.length <= 80 && /^[\p{L}\p{M} .’'-]+$/u.test(value)
    && (value.match(/\p{L}/gu) || []).length >= 2;
}

function contactOnly(value) {
  return !value || contactLabel.test(value) || url.test(value)
    || phone.test(value) && value.replace(/\D/g, '').length >= 7;
}

function contactName(headerLines = []) {
  if (!Array.isArray(headerLines)) return '';
  for (const raw of headerLines) {
    if (typeof raw !== 'string') continue;
    const line = raw.trim();
    if (!line || title.test(line)) continue;
    if (instruction.test(line)) return '';
    const emails = line.match(emailPattern) || [];
    if (emails.length > 1) return '';
    // Remove only an explicit email and its optional label/wrappers. Never infer a name from its local part.
    const remainder = line.replace(/(?:\be-?mail\s*:\s*|mailto:)?<?[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}>?/gi, '|');
    const fragments = remainder.split(/[|;\t•·,]/).map((part) => part.trim()
      .replace(/^[<>()\s]+|[<>()\s]+$/g, '')
      .replace(/^(?:full\s+)?name\s*:\s*/i, '').trim()).filter(Boolean);
    const candidates = fragments.filter((part) => !contactOnly(part));
    if (!candidates.length) continue;
    // Extra unlabeled text may be another person, a role, or an address: leave the name unknown.
    if (candidates.length !== 1 || !validName(candidates[0])) return '';
    return candidates[0];
  }
  return '';
}

module.exports = { contactName };
