const { instruction } = require('../services/jobRequirements');
const { SKILLS } = require('./resumeFacts');

const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const emailWithLabel = /(?:(?:\b(?:(?:(?:candidate|applicant)\s+)?(?:contact|e-?mail(?:\s+address)?|mail)|correspondence|reach\s+me)\s*(?::|=|[-=]>?|[—–/>])\s*)|mailto:)?<?[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}>?/gi;
const emailLabel = /^(?:(?:(?:candidate|applicant)\s+)?(?:contact|e-?mail(?:\s+address)?|mail)|correspondence|reach\s+me)\s*(?::|=|[-=]>?|[—–/>])/i;
const contactLabel = /^(?:(?:(?:candidate|applicant)\s+)?(?:contact|e-?mail(?:\s+address)?|mail)|correspondence|reach\s+me|phone|tel(?:ephone)?|mobile|location|address|linkedin|github|portfolio)\s*(?::|=|[-=]>?|[—–/>])/i;
const nameLabel = /^(?:(?:full|candidate|applicant)\s+name|name|candidate|applicant|r[eé]sum[eé])\s*(?::|=|[-=]>?|[—–/>])\s*/i;
const title = /^(?:(?:[\p{L}\p{M}’'-]+['’]s\s+)?(?:engineering|professional|career|candidate|personal)\s+)?(?:r[eé]sum[eé]|curriculum vitae|cv|dossier|profile)$/iu;
const documentHeading = /^(?:(?:[\p{L}\p{M}-]+\s+){0,3}portfolio(?:\s+(?:card|excerpt|summary|profile))?|(?:applicant|candidate)\s+(?:for\s+.+|statement(?:\s+.+)?)|form export(?:\s*[/|]\s*[\p{L}\p{M} ]+)?)$/iu;
const occupationalHeading = /^(?:[\p{L}\p{M}-]+\s+){2,5}(?:developer|engineer|designer|contractor|analyst|consultant|researcher|specialist)$/u;
const structuredField = /^(?:(full name|candidate name|applicant name|name)|(e-?mail(?: address)?|candidate e-?mail|applicant e-?mail)) *(?:\t+|\||\.{2,})\s*(.+)$/i;
const candidateResume = /^(?:applicant|candidate)\s+(?:r[eé]sum[eé]|curriculum vitae|cv)\s*:?$/i;
const identitySection = /^(?:(?:applicant|candidate)(?: details| contact)?|contact(?: information| details)?|identity|personal details)$/i;
const forwardingHeading = /^forward(?:ed|ing)\s+(?:slip|note|message|cover(?: sheet)?)\s*:?$/i;
const speakerLabel = /^(applicant|candidate|interviewer|moderator|transcriber|facilitator|reviewer|recruiter):\s*(.*)$/i;
const ownEmail = /^(?:my\s+)?e-?mail(?: address)?(?:\s+is\s+|\s*:\s*)<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i;
const referenceHeading = /^(?:(?:professional|personal)\s+)?(?:references|referees)\s*:?$/i;
const simpleHeadings = new Set(['reach me', 'who i am', 'about me', 'about', 'contact', 'contact information', 'contact details', 'correspondence', 'identity and contact', 'personal details', 'personal information', 'candidate details', 'applicant details', 'identity', 'name', 'email address', 'profile', 'summary', 'overview', 'biography', 'introduction', 'professional synopsis', 'self-assessment']);
const heading = /^(?:(?:my|core|key|technical|professional|personal|selected|formal|academic|current)\s+)?(?:skills?(?:\s+(?:and\s+how\s+i\s+use\s+them|summary|sheet))?|competencies|capabilities|tools(?:\s+i\s+use)?|experience|employment|work(?:\s+record)?|career|appointments|education(?:\s+and\s+training)?|training|qualifications?|study|learning(?:\s+record)?|practice|record|repertoire|declaration|statement|role|projects?)\s*[:.=]*$/i;
const role = /^(?:(?:senior|junior|lead|principal|staff|graduate|associate|full[- ]stack|front[- ]end|back[- ]end|software|data|systems?|platform|cloud|devops|quality|security|web|mobile|product|engineering|technical)\s+)*(?:engineer|developer|designer|manager|architect|analyst|consultant|student|researcher|specialist)(?:\s|$)/i;
const organization = /\b(?:inc|llc|ltd|corp|corporation|university|college|institute|school|academy|services|studio|laboratory|lab|works|cooperative|hospital|foundation|company)\.?$/i;
const url = /^(?:https?:\/\/|www\.)\S+$/i;
const phone = /^\+?[\d ().-]+$/;
const skills = new Set(SKILLS.map((skill) => skill.toLowerCase()));

function clean(value) {
  return value.trim().replace(/^#{1,6}\s+/, '').replace(/^[|\[\]<>()\s]+|[|\[\]<>()\s]+$/g, '')
    .replace(/^(\*\*|__)(.+)\1$/, '$2').trim();
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
  return decoration(value) || title.test(value) || documentHeading.test(value) || isHeading(value) || contactLabel.test(value)
    || url.test(value) || role.test(value) || phone.test(value) && value.replace(/\D/g, '').length >= 7;
}

function row(raw) {
  const line = clean(raw);
  if (decoration(line) || instruction.test(line)) return { names: [], explicit: false, ambiguous: instruction.test(line) };
  const emails = line.match(emailPattern) || [];
  if (emails.length > 1) return { names: [], explicit: false, ambiguous: true };
  const remainder = line.replace(emailWithLabel, '|').replace(/\]\s*\[/g, '|').replace(/\s+[—–](?=\s*\|)|(^|\|)\s*[—–]\s+/g, '$1');
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
  // Availability, negation and activity predicates after "I am" are not introductions.
  if (/^(?:not|never|available|unavailable|able|unable|learning|interested|looking|seeking|working|based|located|ready)\b/i.test(candidate)) return '';
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
    if (decoration(line) || title.test(line) || documentHeading.test(line) || occupationalHeading.test(line)
      || isHeading(line) || contactLabel.test(line) || url.test(line)) continue;
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
  let outside = false, keyed = false, speaker = '';
  for (const raw of lines) {
    if (typeof raw !== 'string') continue;
    const line = clean(raw);
    if (referenceHeading.test(line)) break;
    if (instruction.test(line)) {
      if (!outside && !speaker) usable.push(line);
      continue;
    }
    if (forwardingHeading.test(line)) { outside = true; speaker = ''; continue; }
    if (candidateResume.test(line)) { outside = false; keyed = false; speaker = ''; continue; }

    const section = raw.match(/^\s*\[([\w -]+)\]\s*$/)?.[1].replaceAll('_', ' ').trim();
    if (section && (keyed || identitySection.test(section))) {
      keyed = true;
      outside = !identitySection.test(section);
      speaker = '';
      continue;
    }
    if (outside) continue;

    const turn = line.match(speakerLabel);
    if (turn && !/^(?:applicant|candidate)$/i.test(turn[1])) { speaker = 'external'; continue; }
    if (turn && (speaker || /^(?:I\b|my\s)/i.test(turn[2]) || emailLabel.test(turn[2]))) speaker = 'applicant';
    if (speaker === 'external') continue;
    if (speaker === 'applicant') {
      const value = turn?.[2] || line;
      const introduced = introductoryName(value);
      const afterName = introduced ? value.slice(value.indexOf(introduced) + introduced.length).replace(/^\s*[.;]\s*/, '') : '';
      const email = value.match(ownEmail)?.[1] || afterName.match(ownEmail)?.[1];
      if (introduced) usable.push('Name: ' + introduced);
      else if (nameLabel.test(value)) usable.push(value);
      if (email) usable.push('Email: ' + email);
      else if (emailLabel.test(value)) usable.push(value);
      continue;
    }

    const field = line.match(structuredField);
    if (field) { usable.push((field[1] ? 'Name: ' : 'Email: ') + clean(field[3])); continue; }

    // A submission byline identifies its author only at the document entrance.
    const submitted = line.match(/(?:^|[,—]\s+)submitted by\s+(.+)$/i)?.[1];
    if (submitted && submitted.match(emailPattern)?.length === 1
      && usable.every(value => decoration(value) || title.test(value) || documentHeading.test(value))) {
      usable.push('Name: ' + submitted);
      continue;
    }
    usable.push(line.replace(/\s+[›»]\s+/g, ' | '));
  }
  return usable;
}

function findContactName(usable) {
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

/** Accept raw document lines: explicit identity/contact blocks can appear after work history. */
function contactName(lines = []) { return findContactName(documentLines(lines)); }

function contactDetails(lines = []) {
  const usable = documentLines(lines), name = findContactName(usable);
  if (!Array.isArray(usable)) return { name, email: '' };
  const identityRows = [], labeled = [], nearby = [], contactRows = [];
  let ambiguousContactRow = false, contactOnlyHeader = false;
  const firstHeaderIndex = usable.findIndex(line => !decoration(line) && !title.test(line) && !documentHeading.test(line)
    && !occupationalHeading.test(line) && !isHeading(line));
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
    else if (emailLabel.test(line)) labeled.push(emails[0]);
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
