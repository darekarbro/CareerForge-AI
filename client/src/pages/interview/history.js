import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../../components/AppShell/AppShell';
import api from '../../services/api';
import {
  Mic,
  TrendingUp,
  AlertTriangle,
  Award,
  ArrowRight,
  Loader2,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';

export default function InterviewHistoryPage() {
  const [analytics, setAnalytics] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/interview/analytics'),
      api.get('/interview/sessions'),
    ])
      .then(([anaRes, sessRes]) => {
        setAnalytics(anaRes.data.data);
        setSessions(sessRes.data.data || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ProtectedRoute>
        <AppShell>
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#0055ff]" />
          </div>
        </AppShell>
      </ProtectedRoute>
    );
  }

  const trends = analytics?.scoreTrends || [];
  const heatmap = analytics?.topicHeatmap || [];

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="pb-4 border-b-3 border-[#1a1a1a] flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Evaluation History
              </span>
              <h1 className="font-headline font-black text-3xl uppercase tracking-tight text-[#1a1a1a]">
                Interview Readiness Logs
              </h1>
              <p className="text-xs text-gray-600 font-medium">
                Track score progression, evaluate STAR method adherence, and target weak topics.
              </p>
            </div>

            <Link
              href="/interview/setup"
              className="brutal-btn-primary px-4 py-2 text-xs flex items-center gap-1.5"
            >
              <Mic className="w-4 h-4" />
              <span>Start New Mock Session</span>
            </Link>
          </div>

          {/* Charts Row: Trend Line + Weak Topic Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Score Trend Line */}
            <div className="lg:col-span-6 brutal-card p-6">
              <h3 className="font-headline font-black text-base uppercase text-[#1a1a1a] pb-3 border-b-2 border-[#1a1a1a] mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#0055ff]" />
                <span>Score Over Time Progression</span>
              </h3>

              {trends.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500 font-bold uppercase">
                  Complete mock interviews to view historical score trends.
                </div>
              ) : (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8e3da" />
                      <XAxis dataKey="index" stroke="#1a1a1a" fontSize={11} fontWeight={700} />
                      <YAxis domain={[0, 100]} stroke="#1a1a1a" fontSize={11} fontWeight={700} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '2px solid #1a1a1a',
                          boxShadow: '4px 4px 0px #1a1a1a',
                          fontSize: '11px',
                          fontWeight: 'bold',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="overallScore"
                        name="Overall"
                        stroke="#1a1a1a"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#ffcc00' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="technical"
                        name="Technical"
                        stroke="#0055ff"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="clarity"
                        name="Clarity"
                        stroke="#e63b2e"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Topic Heatmap */}
            <div className="lg:col-span-6 brutal-card p-6">
              <h3 className="font-headline font-black text-base uppercase text-[#1a1a1a] pb-3 border-b-2 border-[#1a1a1a] mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#e63b2e]" />
                <span>Weak-Topic Diagnostic Heatmap</span>
              </h3>

              {heatmap.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500 font-bold uppercase">
                  No topic diagnostic data recorded yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {heatmap.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 border-2 border-[#1a1a1a] flex items-center justify-between ${
                        item.averageScore < 70 ? 'bg-[#ffdad6]/60 border-l-8 border-l-[#e63b2e]' : 'bg-white shadow-brutal'
                      }`}
                    >
                      <div>
                        <h4 className="font-headline font-bold text-xs uppercase text-[#1a1a1a]">
                          {item.topic}
                        </h4>
                        <span className="text-[10px] text-gray-500 font-medium">
                          {item.totalAttempts} Question Attempts
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-headline font-black text-sm text-[#1a1a1a]">
                          {item.averageScore}%
                        </span>
                        <span className="block text-[10px] font-bold uppercase text-gray-600">
                          {item.averageScore >= 80 ? 'Proficient' : item.averageScore >= 70 ? 'Satisfactory' : 'Needs Work'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Past Sessions List */}
          <div className="brutal-card p-6">
            <h3 className="font-headline font-black text-base uppercase text-[#1a1a1a] pb-3 border-b-2 border-[#1a1a1a] mb-4">
              All Completed Mock Sessions ({sessions.length})
            </h3>

            {sessions.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500 font-bold uppercase">
                No past sessions found. Start a mock interview above.
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((sess) => (
                  <div
                    key={sess._id}
                    className="p-4 border-2 border-[#1a1a1a] bg-white shadow-brutal flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-[#0055ff] text-white font-black text-[10px] uppercase">
                          {sess.status.replace('_', ' ')}
                        </span>
                        <h4 className="font-headline font-black text-sm uppercase text-[#1a1a1a]">
                          {sess.targetRole}
                        </h4>
                      </div>
                      <p className="text-[11px] text-gray-500 font-medium mt-1">
                        Completed {new Date(sess.createdAt).toLocaleDateString()} • {sess.answeredCount}/{sess.totalQuestions} Questions Evaluated
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block">
                          Overall Score
                        </span>
                        <span className="font-headline font-black text-lg text-[#1a1a1a]">
                          {sess.overallScore || 0}%
                        </span>
                      </div>
                      <Link
                        href={`/interview/session/${sess._id}`}
                        className="brutal-btn-primary px-3.5 py-2 text-xs flex items-center gap-1"
                      >
                        <span>Inspect Q&A</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
