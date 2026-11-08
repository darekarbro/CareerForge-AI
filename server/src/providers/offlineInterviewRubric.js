const normalize = value => String(value || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[–—‑]/g, '-').replace(/\s+/g, ' ').trim();

// Each rule targets a question with a specific invariant. Generic topic overlap
// cannot establish that the candidate answered that question correctly.
const rules = [
  {
    applies: (topic, prompt) => /\bbinary search\b/.test(topic) && /\b(?:prerequisite|precondition|valid|sorted|invariant)\b/.test(prompt),
    checks: [
      ['Explain the input ordering required for the search.', /\b(?:input|array|data|values|elements|entries)\b.{0,45}\b(?:sorted|monotonic|nondecreasing|nonincreasing|ascending|descending)\b|\b(?:sorted|ordered)\s+(?:input|array|data|values|order)\b.{0,45}\b(?:required|needed|before|prerequisite)\b|\b(?:values|elements|entries)\b.{0,45}\b(?:rise|increase|decrease|fall)\b.{0,30}\b(?:consistently|left to right)\b/],
      ['Explain how comparing the middle value lets you discard one side.', /\b(?:midpoint|middle|central)\b.{0,85}\b(?:discard|exclude|choose|contain|eliminate|halve|narrow|side|half)\b|\b(?:compare|check|inspect)\b.{0,35}\b(?:middle|midpoint|central)\b/],
      ['Name a concrete test for an empty input, a boundary or an absent key.', /\b(?:test|tests|check|verify|exercise|cover)\b.{0,80}\b(?:empty|missing|absent|first|last|boundary|not present)\b/],
    ],
    misconception: /\bsorted(?: order| input| array)?\s+(?:is|are)\s+(?:unnecessary|optional|irrelevant|not (?:needed|required))\b|\b(?:need not|doesn't need to|needn't|does not need to)\s+be sorted\b|\b(?:works?|valid)\s+(?:on|with|for)\s+(?:an?\s+)?(?:unsorted|shuffled)\b|\balways\s+(?:discard|drop|skip)\s+(?:the\s+)?(?:left|right)\s+half\b/,
    correction: 'Ordinary binary search relies on a consistent ordering. The comparison determines which half can be discarded.',
  },
  {
    applies: (topic, prompt) => /\b(?:transaction|atomicity|atomic)\b/.test(topic) && /\b(?:atomic|atomicity|rollback|roll back|partial transfer)\b/.test(prompt),
    checks: [
      ['Place both writes in one transaction.', /\b(?:one|single|same|shared)\s+(?:database\s+)?transaction\b|\ball[- ]or[- ]nothing\b.{0,30}\b(?:unit|transaction|operation|work)\b/],
      ['Commit only after both writes succeed.', /\b(?:commit|durable|persist)\b.{0,40}\bafter\s+both\b|\b(?:once|after)\s+both\b.{0,35}\b(?:commit|durable|persist)\b/],
      ['Force a failure between writes and verify both original values.', /\b(?:force|inject|simulate|throw|fail|failure)\b.{0,125}\b(?:retain|unchanged|original|neither|previous|remain)\b.{0,25}\b(?:balance|amount|value|change)|\b(?:force|inject|simulate|throw|fail|failure)\b.{0,125}\b(?:both balances|both accounts|neither balance|each account)\b.{0,50}\b(?:retain|unchanged|original|previous|remain|changes?)\b/],
    ],
    misconception: /\bcommit\s+(?:the\s+)?(?:debit|first (?:write|update|operation))\b.{0,28}\bbefore\b|\b(?:separate|different)\s+(?:database\s+)?connections?\b.{0,40}\bautocommit\s+(?:enabled|on)\b|\brollback\s+(?:automatically\s+)?(?:reverses?|undoes?|cancels?)\b.{0,55}\b(?:earlier transaction|committed|debit commit)\b/,
    correction: 'A rollback affects its own uncommitted transaction. Put both writes in one transaction and verify both balances after an injected failure.',
  },
  {
    applies: (topic, prompt) => /\b(?:http|cache-control)\b/.test(topic) && /\b(?:stop|stops|prevent|prevents|avoid|prohibit|prohibits)\b.{0,35}\b(?:storage|storing|store)\b/.test(prompt),
    checks: [
      ['Identify the Cache-Control response header.', /\bcache[- ]control\b/],
      ['Choose the no-store directive.', /\bno-store\b/],
      ['Verify storage behavior through a repeat request or a cache probe.', /\b(?:repeat|second|twice|both requests|two requests)\b.{0,65}\b(?:request|proxy|cache|origin)\b|\b(?:proxy|cache|origin)\b.{0,65}\b(?:repeat|second|twice|both requests|two requests)\b/],
    ],
    misconception: /\b(?:no-cache|private|max-age\s*=\s*0|must-revalidate)\b.{0,45}\b(?:prevents?|stops?|prohibits?)\b.{0,25}\b(?:storage|storing|caches? (?:from )?storing)\b|\b(?:do not|don't|never)\s+use\s+no-store\b/,
    correction: 'Cache-Control: no-store prevents storage. No-cache allows storage with validation before reuse.',
  },
];

function hasMisconception(text, pattern) {
  return [...text.matchAll(new RegExp(pattern.source, 'g'))].some(match => {
    const prefix = text.slice(Math.max(0, match.index - 40), match.index);
    return !/\b(?:never|avoid|must not|should not|do not|don't|cannot|can't)\s+(?:(?:ever|try to)\s+)?$/.test(prefix);
  });
}

function assessTechnicalAnswer(question, answer) {
  const text = normalize(answer);
  const words = text ? text.split(' ').length : 0;
  const noAnswer = words < 5 || /^(?:i\s+)?(?:do not know|don't know|have no idea|no idea|not sure|cannot explain)[.!?\s]*$/.test(text);
  const prompt = normalize(question.questionText);
  const topic = normalize(`${question.topic || ''} ${prompt}`);
  const rule = question.category !== 'behavioral' && rules.find(item => item.applies(topic, prompt));
  if (!rule) return { technicalAssessment: 'unassessed', technicalScore: noAnswer ? 20 : 50, noAnswer };

  const missing = rule.checks.filter(([, pattern]) => !pattern.test(text)).map(([guidance]) => guidance);
  const covered = rule.checks.length - missing.length;
  const misconception = hasMisconception(text, rule.misconception);
  const technicalScore = noAnswer ? 20 : misconception ? 25 : [30, 55, 68, 92][covered];
  return { technicalAssessment: 'rubric-checked', technicalScore, noAnswer, covered,
    feedback: misconception ? [rule.correction] : missing, misconception };
}

module.exports = { assessTechnicalAnswer };
