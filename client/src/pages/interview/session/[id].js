import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ProtectedRoute from '../../../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../../../components/AppShell/AppShell';
import QuestionCard from '../../../components/QuestionCard/QuestionCard';
import api from '../../../services/api';
import { submitProcessingRequest } from '../../../services/processing';
import usePersistentDraft from '../../../hooks/usePersistentDraft';
import { useAuthStore } from '../../../store/authStore';
import {
  Mic,
  Award,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export default function InterviewSessionPage() {
  const router = useRouter();
  const { id } = router.query;

  const [session, setSession] = useState(null);
  const [sessionOwner, setSessionOwner] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userId = useAuthStore((state) => state.user?.id || state.user?._id);
  const drafts = usePersistentDraft('interview:' + id, session && sessionOwner === userId ? { userId, revision: 0, value: {} } : null);
  const [error, setError] = useState('');

  const fetchSession = useCallback(async (signal) => {
    if (!id || !userId) return;
    setLoading(true);
    try {
      const res = await api.get(`/interview/sessions/${id}`, { signal });
      if (signal?.aborted) return;
      setSession(res.data.data.session);
      setSessionOwner(userId);
      setQuestions(res.data.data.questions || []);
    } catch (err) {
      if (!signal?.aborted) setError(err.response?.data?.message || 'Unable to load interview');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id, userId]);

  useEffect(() => {
    const controller = new AbortController();
    setCurrentIndex(0);
    setSession(null); setQuestions([]);
    fetchSession(controller.signal);
    return () => controller.abort();
  }, [fetchSession]);

  const handleSubmitAnswer = async (questionId, userAnswer, retry = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    try {
      const res = await submitProcessingRequest(`/interview/sessions/${id}/questions/${questionId}/answer`, {
        userAnswer,
        retry,
      });

      const updatedQuestion = res.data.data.question;
      const updatedSession = res.data.data.session;
      if (userId !== (useAuthStore.getState().user?.id || useAuthStore.getState().user?._id)) return false;

      setQuestions((prev) =>
        prev.map((q) => (q._id === questionId ? updatedQuestion : q))
      );
      setSession(updatedSession);
      if (updatedSession.status === 'completed') await fetchSession();
      return true;
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to evaluate the answer. Your draft has been kept.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || session && (sessionOwner !== userId || !drafts.ready)) {
    return (
      <ProtectedRoute>
        <AppShell>
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#0055ff]" />
            <span className="font-headline font-black uppercase text-xs">
              Loading Interview Lab Session...
            </span>
          </div>
        </AppShell>
      </ProtectedRoute>
    );
  }

  if (!session || questions.length === 0) {
    return (
      <ProtectedRoute>
        <AppShell>
          <div className="py-20 text-center space-y-4">
            <h2 className="font-headline font-black text-2xl uppercase">Session Not Found</h2>
            <Link href="/interview/setup" className="brutal-btn-primary px-4 py-2 text-xs">
              Start New Session
            </Link>
          </div>
        </AppShell>
      </ProtectedRoute>
    );
  }

  const currentQ = questions[currentIndex];
  const answeredCount = questions.filter((q) => q.answeredAt || q.feedback?.overallScore !== undefined).length;
  const isAllAnswered = answeredCount === questions.length;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8 max-w-4xl mx-auto">
          {error && <p role="alert" className="p-3 border-2 border-red-800 bg-red-50 text-red-900 text-sm">{error}</p>}
          {/* Header Banner */}
          <div className="p-5 border-3 border-[#1a1a1a] bg-[#ffcc00] shadow-brutal flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-800">
                Interview practice
              </span>
              <h1 className="font-headline font-black text-xl sm:text-2xl uppercase text-[#1a1a1a]">
                {session.targetRole}
              </h1>
              <p className="text-xs text-gray-800 font-bold mt-0.5">
                Answered: {answeredCount} of {questions.length} questions completed
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] font-black uppercase text-gray-700 block">
                  Session Score
                </span>
                <span className="font-headline font-black text-2xl text-[#1a1a1a]">
                  {session.overallScore || 0}%
                </span>
              </div>
              <Link
                href="/interview/history"
                className="px-3 py-1.5 border-2 border-[#1a1a1a] bg-white font-headline font-bold text-xs uppercase hover:bg-gray-100 shadow-brutal"
              >
                Practice history
              </Link>
            </div>
          </div>

          {/* Question Stepper Navigation */}
          <div className="flex flex-wrap gap-2">
            {questions.map((q, idx) => {
              const isAnswered = Boolean(q.answeredAt || q.feedback?.overallScore !== undefined);
              const isCurrent = idx === currentIndex;

              return (
                <button
                  key={q._id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`px-3 py-1.5 border-2 font-headline font-black text-xs uppercase transition-all ${
                    isCurrent
                      ? 'bg-[#0055ff] text-white border-[#1a1a1a] shadow-brutal translate-x-0.5'
                      : isAnswered
                      ? 'bg-green-100 text-green-900 border-green-800'
                      : 'bg-white border-[#1a1a1a] hover:bg-[#faf7f2]'
                  }`}
                >
                  Q{idx + 1} {isAnswered && '✓'}
                </button>
              );
            })}
          </div>

          {/* Active Question Card */}
          {currentQ && (
            <QuestionCard
              key={currentQ._id}
              question={currentQ}
              index={currentIndex}
              total={questions.length}
              onSubmitAnswer={handleSubmitAnswer}
              isSubmitting={isSubmitting}
              draft={drafts.value?.[currentQ._id]?.text}
              onDraftChange={(value) => drafts.change((previous) => ({ ...previous, [currentQ._id]: { ...previous[currentQ._id], text: value } }))}
              timeLimitSeconds={session.timeLimitSeconds}
              timerStartedAt={drafts.value?.[currentQ._id]?.startedAt}
              onTimerStart={(startedAt) => drafts.change((previous) => ({ ...previous, [currentQ._id]: { ...previous[currentQ._id], startedAt } }))}
            />
          )}
          {session.status === 'completed' && <section className="brutal-card p-5 space-y-3"><h2 className="text-xl font-bold">Focused follow-up practice</h2><p className="text-sm">Use the same resume and job description for a new set of probing questions.</p><div className="flex flex-wrap gap-3">{(session.weakTopics?.length ? session.weakTopics : [...new Set(questions.map((item) => item.topic))].slice(0, 3)).map((topic) => <button type="button" key={topic} disabled={isSubmitting} className="border-2 px-3 py-2 text-sm" onClick={async () => { setIsSubmitting(true); setError(''); try { const response = await submitProcessingRequest('/interview/sessions/' + id + '/follow-up', { topic }); router.push('/interview/session/' + response.data.data.session._id); } catch (failure) { setError(failure.message || 'Unable to start follow-up practice'); } finally { setIsSubmitting(false); } }}>Practise {topic}</button>)}</div></section>}

          {/* Stepper Bottom Controls */}
          <div className="flex items-center justify-between pt-4 border-t-2 border-[#1a1a1a]">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 border-2 border-[#1a1a1a] bg-white font-headline font-bold text-xs uppercase flex items-center gap-1.5 disabled:opacity-40"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="brutal-btn-primary px-5 py-2 text-xs flex items-center gap-1.5"
              >
                <span>Next Question</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : isAllAnswered ? (
              <Link
                href="/interview/history"
                className="brutal-btn-yellow px-6 py-2 text-xs flex items-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                <span>View Full Session Analytics</span>
              </Link>
            ) : null}
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
