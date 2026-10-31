import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProtectedRoute from '../../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../../components/AppShell/AppShell';
import useOwnedResource from '../../hooks/useOwnedResource';
import { submitProcessingRequest } from '../../services/processing';
export default function InterviewHistoryPage() {
  const analytics = useOwnedResource('/interview/analytics'), sessions = useOwnedResource('/interview/sessions'), router = useRouter();
  const [working, setWorking] = useState(''), [error, setError] = useState('');
  const practise = async (topic) => {
    const session = sessions.data?.find((item) => item.weakTopics?.includes(topic)) || sessions.data?.[0];
    if (!session) return;
    setWorking(topic); setError('');
    try { const response = await submitProcessingRequest('/interview/sessions/' + session._id + '/follow-up', { topic }); router.push('/interview/session/' + response.data.data.session._id); }
    catch (failure) { setError(failure.response?.data?.message || failure.message || 'Unable to prepare focused practice'); }
    finally { setWorking(''); }
  };
  return <ProtectedRoute><AppShell><div className="max-w-6xl mx-auto space-y-6"><header className="flex flex-wrap justify-between gap-4"><div><h1 className="text-3xl font-bold">Practice history</h1><p className="text-sm mt-2">See your latest answer scores and choose what to practise next.</p></div><Link href="/interview/setup" className="brutal-btn-primary px-4 py-3 text-sm">Start a new session</Link></header>
    {error && <p role="alert" className="bg-red-50 p-3">{error}</p>}
    {analytics.loading ? <p role="status">Loading your progress…</p> : analytics.error ? <p role="alert">{analytics.error} <button onClick={() => analytics.reload()} className="underline">Retry analytics</button></p> : analytics.data && <div className="grid lg:grid-cols-2 gap-5">
      <section className="brutal-card p-5"><h2 className="text-xl font-bold mb-3">Scores over time</h2>{!analytics.data.scoreTrends.length ? <p className="text-sm">Complete a session to see your progress.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left" scope="col">Session</th><th className="text-left" scope="col">Role</th><th className="text-right" scope="col">Score</th></tr></thead><tbody>{analytics.data.scoreTrends.map((item) => <tr key={item.sessionId} className="border-t"><td className="py-2"><Link href={'/interview/session/' + item.sessionId} className="underline">{item.index}</Link></td><td>{item.targetRole}</td><td className="text-right font-bold">{item.overallScore}%</td></tr>)}</tbody></table></div>}</section>
      <section className="brutal-card p-5"><h2 className="text-xl font-bold mb-3">Topics to practise</h2>{!analytics.data.topicHeatmap.length ? <p className="text-sm">Your topic feedback appears after answering questions.</p> : <ul className="space-y-3">{[...analytics.data.topicHeatmap].sort((a, b) => a.averageScore - b.averageScore).map((item) => <li key={item.topic} className="border-b pb-3 flex flex-wrap justify-between gap-3 text-sm"><div><strong>{item.topic}</strong><p>{item.averageScore}% · {item.totalAttempts} questions reviewed · {item.averageScore < 70 ? 'Needs practice' : 'Keep building confidence'}</p></div><button type="button" disabled={Boolean(working) || !sessions.data?.length} onClick={() => practise(item.topic)} className="border-2 px-3 py-2 disabled:opacity-40">{working === item.topic ? 'Preparing…' : 'Practise this topic'}</button></li>)}</ul>}</section>
    </div>}
    <section className="brutal-card p-5"><h2 className="text-xl font-bold mb-4">Your sessions</h2>{sessions.loading ? <p role="status">Loading sessions…</p> : sessions.error ? <p role="alert">{sessions.error} <button className="underline" onClick={() => sessions.reload()}>Retry sessions</button></p> : !sessions.data?.length ? <p className="text-sm">No practice sessions yet. Start with a role or a saved job.</p> : <ul className="space-y-3">{sessions.data.map((item) => <li key={item._id} className="border-2 p-4 flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-bold">{item.targetRole}</h3><p className="text-sm">{new Date(item.createdAt).toLocaleDateString()} · {item.difficulty || 'Medium'} · {item.answeredCount}/{item.totalQuestions} answered · {item.status === 'completed' ? 'Completed' : 'In progress'}</p>{item.topicFocus && <p className="text-sm">Focus: {item.topicFocus}</p>}</div><Link className="underline text-sm text-blue-700" href={'/interview/session/' + item._id}>{item.status === 'completed' ? 'Review answers' : 'Continue practice'}</Link></li>)}</ul>}</section>
  </div></AppShell></ProtectedRoute>;
}
