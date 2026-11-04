const { instruction } = require('../services/jobRequirements');
const { SKILLS } = require('./resumeFacts');

const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const emailWithLabel = /(?:(?:\b(?:e-?mail|mail|candidate\s+contact)\s*(?::|=|[-=]>?|\/|>)\s*)|mailto:)?<?[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}>?/gi;
const contactLabel = /^(?:(?:candidate\s+)?contact|e-?mail|mail|phone|tel(?:ephone)?|mobile|location|address|linkedin|github|portfolio)\s*(?::|=|[-=]>?|\/|>)/i;
const nameLabel = /^(?:(?:full|candidate)\s+name|name|candidate|resume)\s*(?::|=|[-=]>?|\/|>)\s*/i;
const title = /^(?:resume|curriculum vitae|cv)$/i;
const referenceHeading = /^(?:(?:professional|personal)\s+)?(?:references|referees)\s*:?$/i;
const simpleHeadings = new Set(['reach me', 'who i am', 'about me', 'about', 'contact', 'contact information', 'contact details', 'correspondence', 'identity and contact', 'personal details', 'personal information', 'candidate details', 'applicant details', 'identity', 'name', 'email address', 'profile', 'summary', 'overview', 'biography', 'introduction', 'professional synopsis', 'self-assessment']);
const heading = /^(?:(?:my|core|key|technical|professional|personal|selected|formal|academic|current)\s+)?(?:skills?(?:\s+(?:and\s+how\s+i\s+use\s+them|summary|sheet))?|competencies|capabilities|tools(?:\s+i\s+use)?|experience|employment|work(?:\s+record)?|career|appointments|education(?:\s+and\s+training)?|training|qualifications?|study|learning(?:\s+record)?|practice|record|repertoire|declaration|statement|role|projects?)\s*[:.=]*$/i;
const role = /^(?:(?:senior|junior|lead|principal|staff|graduate|associate|full[- ]stack|front[- ]end|back[- ]end|software|data|systems?|platform|cloud|devops|quality|security|web|mobile|product|engineering|technical)\s+)*(?:engineer|developer|designer|manager|architect|analyst|consultant|student|researcher|specialist)(?:\s|$)/i;
const organization = /\b(?:inc|llc|ltd|corp|corporation|university|college|institute|school|academy|services|studio|laboratory|lab|works|cooperative|hospital|foundation|company)\.?$/i;
const url = /^(?:https?:\/\/|www\.)\S+$/i;
const phone = /^\+?[\d ().-]+$/;
const skills = new Set(SKILLS.map((skill) => skill.toLowerCase()));

function clean(value) {
  return value.trim().replace(/^#{1,6}\s+/, '').replace(/^[|\[\]<>()\s]+|[|\[\]<>()\s]+$/g, '').trim();
}

function isHeading(value) {
  return simpleHeadings.has(value.toLowerCase().replace(/[:.=]+$/, '').trim()) || heading.test(value);
}

function validName(value) {
  return value.length <= 80 && /^[\p{L}\p{M} .’'-]+$/u.test(value)
    && (value.match(/\p{L}/gu) || []).length >= 2 && value.split(/\s+/).length <= 6
    && !/^(?:I|we|my|our|the|this|that|there)\b/i.test(value) && !role.test(value.replace(/^(?:a|an)\s+/i, ''));
}

function decoration(value) {
  return !value || /^[-=+_|*~─━│┌┐└┘╔╗╚╝═\s]+$/.test(value);
}

function nonName(value) {
  return decoration(value) || title.test(value) || isHeading(value) || contactLabel.test(value)
    || url.test(value) || role.test(value) || phone.test(value) && value.replace(/\D/g, '').length >= 7;
}

function row(raw) {
  const line = clean(raw);
  if (decoration(line) || instruction.test(line)) return { names: [], explicit: false, ambiguous: instruction.test(line) };
  const emails = line.match(emailPattern) || [];
  if (emails.length > 1) return { names: [], explicit: false, ambiguous: true };
  const remainder = line.replace(emailWithLabel, '|').replace(/\]\s*\[/g, '|');
  const separator = nameLabel.test(remainder) ? /[|;\t•·,/>]/ : /[|;\t•·,/>]|\s{2,}/;
  const fragments = remainder.split(separator).map(clean).filter(Boolean);
  let explicit = false, invalid = false;
  const names = [];
  for (let fragment of fragments) {
    const labeled = nameLabel.test(fragment);
    if (labeled) { explicit = true; fragment = clean(fragment.replace(nameLabel, '')); }
    if (nonName(fragment) || !fragment) continue;
    if (validName(fragment) && (labeled || !organization.test(fragment) && !skills.has(fragment.toLowerCase()))) names.push(fragment.replace(/\s+/g, ' '));
    else invalid = true;
  }
  return { names, explicit, ambiguous: names.length > 1 || invalid && names.length > 0, unrecognized: invalid, hasEmail: emails.length === 1 };
}

function unique(values) {
  const result = new Map();
  for (const value of values) {
    const key = value.toLocaleLowerCase().replace(/\s+/g, ' ');
    if (!result.has(key)) result.set(key, value);
  }
  return [...result.values()];
}

function introductoryName(raw) {
  const line = clean(raw);
  if (instruction.test(line)) return '';
  // First-person introductions are identity signals; quoted introductions belong to their speaker.
  const introduction = line.match(/^(?:i\s+am|i['’]m|my\s+name\s+is)\s+(.+)$/i);
  if (!introduction) return '';
  let candidate = introduction[1].split(/,|\s+and\s+I\b|\s+(?:and\s+)?(?:currently|now)\b/)[0].trim();
  for (const ending of candidate.matchAll(/\.(?=\s|$)/g)) {
    const word = candidate.slice(0, ending.index).match(/([\p{L}\p{M}]+)$/u)?.[1] || '';
    if (word.length === 1 || /^(?:Dr|Mr|Ms|Mrs|Mx|Prof|St|Jr|Sr)$/i.test(word)) continue;
    candidate = candidate.slice(0, ending.index).trim(); break;
  }
  return validName(candidate) ? candidate : '';
}

function frontMatterName(lines) {
  // Do not search body prose for arbitrary name-shaped strings.
  for (const raw of lines) {
    const line = clean(raw);
    if (decoration(line) || title.test(line) || isHeading(line) || contactLabel.test(line) || url.test(line)) continue;
    if (role.test(line) || /\b(?:19|20)\d{2}\s*(?:[-—–]|to|through)\s*(?:(?:19|20)\d{2}|present|current)\b/i.test(line)
      || /^(?:I|we|my|our|built|implemented|developed|wrote|used|worked|managed|maintained|created|designed|tested)\b/i.test(line)) return '';
    const result = row(raw);
    if (result.ambiguous) return '';
    if (result.names.length === 1) return result.names[0];
    if (result.explicit && !result.unrecognized) continue;
    if (result.hasEmail && !result.names.length || phone.test(line)) continue;
    return '';
  }
  return '';
}

function documentLines(lines) {
  if (!Array.isArray(lines)) return '';
  const usable = [];
  for (const raw of lines) {
    if (typeof raw !== 'string') continue;
    if (referenceHeading.test(clean(raw))) break;
    usable.push(raw);
  }
  return usable;
}

/** Accept raw document lines: explicit identity/contact blocks can appear after work history. */
function contactName(lines = []) {
  const usable = documentLines(lines);
  if (!Array.isArray(usable)) return '';
  const explicit = [], introductions = [], emailRows = [];
  for (const line of usable) {
    if (instruction.test(line)) continue;
    const result = row(line), introduced = introductoryName(line);
    if (introduced) introductions.push(introduced);
    if (!result.ambiguous && result.names.length === 1) {
      if (result.explicit) explicit.push(result.names[0]);
      else if (result.hasEmail) emailRows.push(result.names[0]);
    }
  }
  const front = frontMatterName(usable);
  const named = unique([...explicit, ...introductions, ...(front ? [front] : [])]);
  if (named.length) return named.length === 1 ? named[0] : '';
  const withEmail = unique(emailRows);
  return withEmail.length === 1 ? withEmail[0] : '';
}

function contactDetails(lines = []) {
  const usable = documentLines(lines), name = contactName(lines);
  if (!Array.isArray(usable)) return { name, email: '' };
  const identityRows = [], labeled = [], nearby = [], contactRows = [];
  let ambiguousContactRow = false, contactOnlyHeader = false;
  const firstHeaderIndex = usable.findIndex(raw => !decoration(clean(raw)) && !title.test(clean(raw)));
  const equalName = value => value.toLocaleLowerCase().replace(/\s+/g, ' ') === name.toLocaleLowerCase().replace(/\s+/g, ' ');
  const identityIndexes = [];
  usable.forEach((line, index) => {
    const data = row(line);
    if (name && (data.names.some(equalName) || equalName(introductoryName(line)))) identityIndexes.push(index);
  });
  let contactSection = false;
  usable.forEach((raw, index) => {
    const line = clean(raw);
    if (/^(?:contact(?: information)?|identity and contact|correspondence|reach me)\s*:?[.=]*$/i.test(line)) contactSection = true;
    else if (isHeading(line) && !decoration(line)) contactSection = false;
    if (instruction.test(line) || /\b(?:colleague|coworker|co-worker|teammate|referee|reference|client|customer|recruiter)\b/i.test(line)) return;
    const emails = [...new Set(line.match(emailPattern) || [])];
    if (emails.length !== 1) return;
    const data = row(line);
    if (index === firstHeaderIndex && !data.names.length && !data.ambiguous && !data.unrecognized) contactOnlyHeader = true;
    if (!data.unrecognized) {
      contactRows.push(emails[0]);
      if (data.names.length > 1) ambiguousContactRow = true;
    }
    if (name && !data.ambiguous && data.names.some(equalName)) identityRows.push(emails[0]);
    else if (/^(?:(?:candidate\s+)?contact|e-?mail|mail)\s*(?::|=|[-=]>?|\/|>)/i.test(line)) labeled.push(emails[0]);
    else if (!data.names.length && !data.ambiguous && !data.unrecognized && (contactSection || identityIndexes.some(identityIndex => Math.abs(identityIndex - index) <= 3))) nearby.push(emails[0]);
  });
  // A multi-name header cannot identify a person, but its sole contact address is still explicit evidence.
  // Keep competing contact-formatted addresses ambiguous without considering prose or third-party emails.
  if (!name && ambiguousContactRow) {
    const values = [...new Set(contactRows)];
    return { name, email: values.length === 1 ? values[0] : '' };
  }
  for (const candidates of [identityRows, labeled, nearby]) {
    const values = [...new Set(candidates)];
    if (values.length) return { name, email: values.length === 1 ? values[0] : '' };
  }
  if (!name && contactOnlyHeader) {
    const values = [...new Set(contactRows)];
    if (values.length === 1) return { name, email: values[0] };
  }
  return { name, email: '' };
}

module.exports = { contactName, contactDetails };
