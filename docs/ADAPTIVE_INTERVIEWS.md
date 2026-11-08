# Adaptive interview policy

New sessions use `adaptiveEnabled: true`; callers can choose a fixed question set with `false`. Existing sessions keep the fixed behavior. Adaptive sessions answer in order. After evaluation, the next unanswered question keeps its ID and order but changes to a follow-up on the previous topic. The original question count is the hard limit, so a one-question session has no follow-up slot.

The deterministic `adaptive-interview-v3` policy selects these branches.

- **Diagnostic / Easy.** A technical score below 40 selects a smaller check. For general questions, fewer than eight words or explicit uncertainty can also select this branch. The first diagnostic asks for a basic definition, example and check. Consecutive diagnostics rotate smaller exercises tied to the previous answer.
- **Deeper / Hard.** A technical score of at least 75 and relevance of at least 70 qualify. Provider feedback follows the 30-word threshold, while an answer that passes the applicable local technical checks can be concise. The follow-up asks about a failure or workload constraint.
- **Clarification.** An incomplete or technically unassessed answer receives a specific follow-up. The prompt can quote up to 180 characters and ask for an uncovered rubric point with a concrete action.

Selection is recorded in `question.adaptation` with its source question and answer excerpt. The offline rubric checks specific concepts and misconceptions for questions about binary search prerequisites, transaction atomicity and HTTP response storage. Other questions receive provisional relevance and structure feedback with technical correctness marked unassessed. The checks cover bounded phrasing and common errors. Review the answer reasoning and evidence when judging competence.

Each source resolves its branch once. Retries update feedback and preserve the existing branch; replayed worker commits recover an unfinished branch without adding questions. Pending or answered questions cannot be replaced. In end-feedback mode, feedback, model answers, attempt assessments and adaptation rationale remain hidden until completion. The follow-up wording and difficulty are necessarily visible as part of the practice question.

Run `node --require ./test/setup.cjs --test test/adaptiveInterview.test.js` from `server` for policy checks. The integration suite also exercises sequential guards, ownership, bounded question counts, retries and delayed-feedback privacy.
