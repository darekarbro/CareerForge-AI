import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProtectedRoute from '../../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../../components/AppShell/AppShell';
import useOwnedResource from '../../hooks/useOwnedResource';
import { submitProcessingRequest } from '../../services/processing';

const statusLabels = { gap: 'Needs practice', developing: 'Developing', strength: 'Demonstrated strength' };
function EvidenceLinks({ evidence = [] }) {
  return <ul className="space-y-3 text-sm">{evidence.map((item) => <li key={item.sessionId + ':' + item.questionId + ':' + item.attemptIndex} className="border-l-4 pl-3"><Link href={item.href} className="underline text-blue-800">{item.questionText} · Attempt {item.attemptIndex + 1}{item.current ? ' (latest)' : ''}</Link><blockquote className="mt-1 whitespace-pre-wrap">{item.answerExcerpt}</blockquote><p className="text-xs text-gray-600 mt-1">{item.score}% · {item.provider === 'deterministic-fallback' ? 'Offline rubric estimate' : 'Practice estimate'} · {new Date(item.answeredAt).toLocaleDateString()}</p></li>)}</ul>;
}
export default function InterviewProgressPage() {
  const profile = useOwnedResource('/interview/competencies'), plan = useOwnedResource('/interview/learning-plan'), router = useRouter();
  const [working, setWorking] = useState(''), [error, setError] = useState('');
  const reassess = async (item) => {
    const source = item.sourceEvidence?.find((evidence) => evidence.sessionId);
    if (!source) { router.push('/interview/setup'); return; }
    setWorking(item.topic); setError('');
    try {
      const response = await submitProcessingRequest('/interview/sessions/' + source.sessionId + '/follow-up', { topic: item.reassessment.topicFocus, difficulty: item.reassessment.difficulty });
      router.push('/interview/session/' + response.data.data.session._id);
    } catch (failure) { setError(failure.response?.data?.message || failure.message || 'Unable to start reassessment.'); }
    finally { setWorking(''); }
  };
  return <ProtectedRoute><AppShell><div className="max-w-5xl mx-auto space-y-6">
    <Link href="/interview/history" className="underline text-blue-800 text-sm">Practice history</Link>
    <h1 className="text-3xl font-bold">Competencies and learning plan</h1>
    <p className="text-sm">Follow your demonstrated strengths and practice gaps across sessions. Open the original answers to review the evidence. Topics you have not practised remain unassessed.</p>
    {error && <p role="alert" className="bg-red-50 p-3">{error}</p>}
    <section className="brutal-card p-5 space-y-4"><h2 className="text-xl font-bold">Your competency profile</h2>
      {profile.loading ? <p role="status">Loading competency evidence…</p> : profile.error ? <p role="alert">{profile.error} <button onClick={() => profile.reload()} className="underline">Retry profile</button></p> : <>
        {!profile.data?.competencies.length ? <p className="text-sm">Answer practice questions to build your profile. Feedback from sessions set to “After completing the session” appears after completion.</p> : <ul className="space-y-5">{profile.data.competencies.map((item) => <li key={item.topic} className="border-2 p-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{item.topic}</h3><span className="text-sm">{statusLabels[item.status]} · {item.averageScore}%</span></div>
          <p className="text-sm">{item.sampleCount} questions across {item.sessionCount} sessions · {item.attemptCount} answer attempts · {item.confidence} confidence. Latest attempts count once per question.</p>
          {item.trend && <p className="text-sm">First to latest attempt: {item.trend.firstScore}% → {item.trend.latestScore}%. Different questions and difficulty can affect this change.</p>}
          <details><summary className="cursor-pointer text-sm font-semibold">Answers behind {item.topic}</summary><div className="mt-3"><EvidenceLinks evidence={item.evidence} /></div>{item.omittedEvidenceCount > 0 && <p className="text-sm mt-3">{item.omittedEvidenceCount} older answers are available in practice history.</p>}</details>
        </li>)}</ul>}
        <details className="text-sm"><summary>How to interpret these assessments</summary><p className="mt-2">Rubric {profile.data?.rubricVersion}</p><ul className="list-disc pl-5 mt-2 space-y-1">{profile.data?.limitations?.map((item) => <li key={item}>{item}</li>)}</ul></details>
      </>}
    </section>
    <section className="brutal-card p-5 space-y-4"><h2 className="text-xl font-bold">Your learning plan</h2>
      {plan.loading ? <p role="status">Preparing learning plan…</p> : plan.error ? <p role="alert">{plan.error} <button onClick={() => plan.reload()} className="underline">Retry learning plan</button></p> : !plan.data?.items.length ? <p className="text-sm">Your next practice tasks appear after assessed answers or a saved job gap analysis. <Link className="underline" href="/interview/setup">Start practice</Link></p> : <ol className="space-y-5">{plan.data.items.map((item) => <li key={item.topic} className="border-2 p-4 space-y-4">
        <h3 className="font-bold">{item.topic}</h3><p className="text-sm">{item.reason}</p>
        {[['practiceTasks', 'Practice tasks'], ['projectMilestones', 'Small project milestones']].map(([key, label]) => <div key={key}><h4 className="font-semibold text-sm">{label}</h4><ol className="list-decimal pl-5 mt-2 space-y-3 text-sm">{item[key].map((task) => <li key={task.title}><strong>{task.title}</strong><p>{task.instructions}</p><p className="mt-1">Done when: {task.doneWhen}</p></li>)}</ol></div>)}
        {item.sourceEvidence?.length > 0 && <details className="text-sm"><summary>Evidence for this practice gap</summary><div className="mt-3"><EvidenceLinks evidence={item.sourceEvidence} /></div></details>}
        <div className="text-sm space-y-2"><h4 className="font-semibold">Reassessment · {item.reassessment.difficulty} · {item.reassessment.count} questions</h4><ul className="list-disc pl-5">{item.reassessment.successCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul><button type="button" disabled={Boolean(working)} onClick={() => reassess(item)} className="brutal-btn-primary px-4 py-2 disabled:opacity-40">{working === item.topic ? 'Preparing…' : 'Reassess ' + item.topic}</button></div>
      </li>)}</ol>}
      {!!plan.data?.limitations?.length && <details className="text-sm"><summary>Learning plan limitations</summary><ul className="list-disc pl-5 mt-2 space-y-1">{plan.data.limitations.map((item) => <li key={item}>{item}</li>)}</ul></details>}
    </section>
  </div></AppShell></ProtectedRoute>;
}
