import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ProtectedRoute from '../../../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../../../components/AppShell/AppShell';
import QuestionCard from '../../../components/QuestionCard/QuestionCard';
import api from '../../../services/api';
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
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSession = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/interview/sessions/${id}`);
      setSession(res.data.data.session);
      setQuestions(res.data.data.questions || []);
    } catch (err) {
      console.error('Error fetching session:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [id]);

  const handleSubmitAnswer = async (questionId, userAnswer) => {
    setIsSubmitting(true);
    try {
      const res = await api.post(`/interview/sessions/${id}/questions/${questionId}/answer`, {
        userAnswer,
      });

      const updatedQuestion = res.data.data.question;
      const updatedSession = res.data.data.session;

      setQuestions((prev) =>
        prev.map((q) => (q._id === questionId ? updatedQuestion : q))
      );
      setSession(updatedSession);
    } catch (err) {
      console.error('Failed to submit answer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
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
  const answeredCount = questions.filter((q) => q.feedback?.overallScore !== undefined).length;
  const isAllAnswered = answeredCount === questions.length;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8 max-w-4xl mx-auto">
          {/* Header Banner */}
          <div className="p-5 border-3 border-[#1a1a1a] bg-[#ffcc00] shadow-brutal flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-800">
                Live Simulation Active
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
                All Logs
              </Link>
            </div>
          </div>

          {/* Question Stepper Navigation */}
          <div className="flex flex-wrap gap-2">
            {questions.map((q, idx) => {
              const isAnswered = Boolean(q.feedback?.overallScore !== undefined);
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
              question={currentQ}
              index={currentIndex}
              total={questions.length}
              onSubmitAnswer={handleSubmitAnswer}
              isSubmitting={isSubmitting}
            />
          )}

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
