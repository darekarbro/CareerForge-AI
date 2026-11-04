# Adaptive interview policy

New sessions use `adaptiveEnabled: true`; callers can choose a fixed question set with `false`. Existing sessions keep the fixed behavior. Adaptive sessions answer in order. After evaluation, the next unanswered question keeps its ID and order but changes to a follow-up on the previous topic. The original question count is the hard limit, so a one-question session has no follow-up slot.

The deterministic `adaptive-interview-v2` policy selects:

- **Diagnostic / Easy:** fewer than eight words, an explicit statement of uncertainty, or technical rubric score below 40. Initially ask for a basic definition, example and check. If the previous question was already diagnostic, quote its answer and narrow the task to a single input and predicted result, a first action and expected observation, or a boundary condition and safe result. These three smaller checks rotate by the stable question order so successive diagnostics do not repeat the same generic definition prompt. A low offline score can still select this branch after a substantial answer; the score does not verify technical correctness.
- **Deeper / Hard:** at least 30 words, technical score at least 75 and relevance at least 70. Add a failure or workload constraint and ask for alternatives, a test and recovery.
- **Clarification:** otherwise, quote up to 180 characters of the submitted answer and ask for an uncovered rubric point with a concrete personal action.

Selection is recorded in `question.adaptation` with its source question and answer excerpt. This is a transparent routing heuristic, not proof of technical competence. Provider scores can be wrong, and the offline evaluator measures length, rubric terms and structure rather than verifying correctness. A verbose answer can therefore receive a deeper prompt without demonstrating mastery.

Each source resolves its branch once. Retries update feedback and preserve the existing branch; replayed worker commits recover an unfinished branch without adding questions. Pending or answered questions cannot be replaced. In end-feedback mode, feedback, model answers, attempt assessments and adaptation rationale remain hidden until completion. The follow-up wording and difficulty are necessarily visible as part of the practice question.

Run `node --require ./test/setup.cjs --test test/adaptiveInterview.test.js` from `server` for policy checks. The integration suite also exercises sequential guards, ownership, bounded question counts, retries and delayed-feedback privacy.
