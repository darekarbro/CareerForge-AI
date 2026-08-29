import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../components/AppShell/AppShell';
import MetricGrid from '../components/MetricGrid/MetricGrid';
import ProcessingTimeline from '../components/ProcessingTimeline/ProcessingTimeline';
import { useResumeStore } from '../store/resumeStore';
import { useAuthStore } from '../store/authStore';
import { subscribeToUserEvents } from '../services/socket';
import {
  FileUp,
  Sparkles,
  Mic,
  Compass,
  ArrowUpRight,
  TrendingUp,
  FileText,
  Clock,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuthStore();
  const { dashboardMetrics, fetchDashboardMetrics, activeJobTimeline, addTimelineEvent } = useResumeStore();
  const [liveEvents, setLiveEvents] = useState([]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardMetrics();
    }

    if (user?.id || user?._id) {
      const uid = user.id || user._id;
      const unsubscribe = subscribeToUserEvents(uid, (event) => {
        addTimelineEvent(event);
        setLiveEvents((prev) => [event, ...prev.slice(0, 7)]);
      });
      return () => unsubscribe();
    }
  }, [fetchDashboardMetrics, user, isAuthenticated, addTimelineEvent]);

  const trends = dashboardMetrics?.interviewTrends || [
    { session: 'S1', score: 65, date: 'Week 1' },
    { session: 'S2', score: 72, date: 'Week 2' },
    { session: 'S3', score: 81, date: 'Week 3' },
    { session: 'S4', score: 88, date: 'Week 4' },
  ];

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8">
          {/* Welcome Header */}
          <div className="p-6 border-3 border-[#1a1a1a] bg-[#ffcc00] shadow-brutal flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-800">
                Candidate Control Console
              </span>
              <h1 className="font-headline font-black text-2xl sm:text-4xl text-[#1a1a1a] uppercase leading-tight">
                Welcome back, {user?.name || 'Engineer'}
              </h1>
              <p className="text-xs text-gray-800 font-bold mt-1">
                Target Role Preference: <span className="underline">{user?.targetRolePreference || 'Fullstack Developer'}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/resume/upload"
                className="brutal-btn-primary px-4 py-2.5 text-xs flex items-center gap-1.5"
              >
                <FileUp className="w-4 h-4" />
                <span>Upload New Resume</span>
              </Link>
              <Link
                href="/interview/setup"
                className="brutal-btn-blue px-4 py-2.5 text-xs flex items-center gap-1.5"
              >
                <Mic className="w-4 h-4" />
                <span>Start Mock Session</span>
              </Link>
            </div>
          </div>

          {/* Metric Grid KPIs */}
          <MetricGrid metrics={dashboardMetrics} />

          {/* Core Dashboard Grid: Quick Actions + Interview Trend Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Quick Action Matrix */}
            <div className="lg:col-span-4 space-y-3">
              <h3 className="font-headline font-black text-base uppercase text-[#1a1a1a] pb-2 border-b-2 border-[#1a1a1a]">
                Quick Action Matrix
              </h3>

              <Link
                href="/resume/upload"
                className="brutal-card p-4 flex items-center justify-between group hover:bg-[#faf7f2] block"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 border-2 border-[#1a1a1a] bg-[#ffcc00]">
                    <FileUp className="w-5 h-5 text-[#1a1a1a]" />
                  </div>
                  <div>
                    <h4 className="font-headline font-black text-sm uppercase text-[#1a1a1a]">
                      Upload & Parse
                    </h4>
                    <p className="text-[11px] text-gray-600 font-medium">
                      Extract structured data & ATS scores
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-[#1a1a1a]" />
              </Link>

              <Link
                href="/interview/setup"
                className="brutal-card p-4 flex items-center justify-between group hover:bg-[#faf7f2] block"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 border-2 border-[#1a1a1a] bg-[#0055ff] text-white">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-headline font-black text-sm uppercase text-[#1a1a1a]">
                      Mock Interview Lab
                    </h4>
                    <p className="text-[11px] text-gray-600 font-medium">
                      Practice questions with STAR scoring
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-[#1a1a1a]" />
              </Link>

              <Link
                href="/jobs"
                className="brutal-card p-4 flex items-center justify-between group hover:bg-[#faf7f2] block"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 border-2 border-[#1a1a1a] bg-[#e63b2e] text-white">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-headline font-black text-sm uppercase text-[#1a1a1a]">
                      Job Search Hub
                    </h4>
                    <p className="text-[11px] text-gray-600 font-medium">
                      Deep links for LinkedIn & Naukri
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-[#1a1a1a]" />
              </Link>

              <Link
                href="/applications"
                className="brutal-card p-4 flex items-center justify-between group hover:bg-[#faf7f2] block"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 border-2 border-[#1a1a1a] bg-[#1a1a1a] text-[#ffcc00]">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-headline font-black text-sm uppercase text-[#1a1a1a]">
                      Application Board
                    </h4>
                    <p className="text-[11px] text-gray-600 font-medium">
                      Kanban status & conversion funnel
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-[#1a1a1a]" />
              </Link>
            </div>

            {/* Score Progress Chart */}
            <div className="lg:col-span-8 brutal-card p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1a1a] mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#0055ff]" />
                  <h3 className="font-headline font-black text-base uppercase text-[#1a1a1a]">
                    Interview Readiness Score Trend
                  </h3>
                </div>
                <span className="text-[10px] font-black uppercase text-gray-500 bg-[#f5f0e8] px-2 py-0.5 border border-[#1a1a1a]">
                  Overall Performance (%)
                </span>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e3da" />
                    <XAxis dataKey="session" stroke="#1a1a1a" fontSize={11} fontWeight={700} />
                    <YAxis domain={[0, 100]} stroke="#1a1a1a" fontSize={11} fontWeight={700} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '2px solid #1a1a1a',
                        boxShadow: '4px 4px 0px #1a1a1a',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#1a1a1a"
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#ffcc00', stroke: '#1a1a1a', strokeWidth: 2 }}
                      activeDot={{ r: 8, fill: '#0055ff', stroke: '#1a1a1a', strokeWidth: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-3 border-t-2 border-[#1a1a1a] flex items-center justify-between text-xs font-bold text-gray-600">
                <span>Evaluation rubrics: Clarity, Relevance, STAR adherence, Technical depth</span>
                <Link href="/interview/history" className="text-[#0055ff] hover:underline uppercase">
                  Full Analytics →
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom Grid: Recent Resumes & Real-Time Agent Stream */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Recent Resumes */}
            <div className="lg:col-span-6 brutal-card p-6">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1a1a] mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#1a1a1a]" />
                  <h3 className="font-headline font-black text-base uppercase text-[#1a1a1a]">
                    Parsed Resume Inventory
                  </h3>
                </div>
                <Link href="/resume/upload" className="text-xs font-bold text-[#0055ff] hover:underline uppercase">
                  + Upload
                </Link>
              </div>

              {(dashboardMetrics?.recentResumes || []).length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500 font-bold uppercase">
                  No resumes uploaded yet. Upload a resume to generate tailored versions.
                </div>
              ) : (
                <div className="space-y-3">
                  {(dashboardMetrics?.recentResumes || []).map((res) => (
                    <div
                      key={res._id}
                      className="p-3 border-2 border-[#1a1a1a] bg-white shadow-brutal flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 border-2 border-[#1a1a1a] bg-[#ffcc00] font-black text-xs">
                          {res.fileType?.toUpperCase() || 'PDF'}
                        </div>
                        <div>
                          <h4 className="font-headline font-bold text-xs uppercase text-[#1a1a1a]">
                            {res.title}
                          </h4>
                          <span className="text-[10px] text-gray-500 font-medium">
                            Uploaded {new Date(res.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-gray-500 block uppercase">
                            ATS Score
                          </span>
                          <span className="font-headline font-black text-sm text-[#1a1a1a]">
                            {res.atsScore?.score || 0}%
                          </span>
                        </div>
                        <Link
                          href={`/resume/${res._id}`}
                          className="px-2.5 py-1 bg-[#1a1a1a] text-white border-2 border-[#1a1a1a] text-xs font-bold uppercase shadow-brutal hover:bg-[#ffcc00] hover:text-[#1a1a1a] transition-all"
                        >
                          Inspect
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Processing Timeline */}
            <div className="lg:col-span-6">
              <ProcessingTimeline
                events={activeJobTimeline.length > 0 ? activeJobTimeline : liveEvents}
                title="Live Multi-Agent Event Stream"
              />
            </div>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
