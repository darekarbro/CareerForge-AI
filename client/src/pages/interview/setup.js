import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../../components/AppShell/AppShell';
import api from '../../services/api';
import { Mic, Sparkles, FileText, ArrowRight, Loader2, Award } from 'lucide-react';

const supportedRoles = [
  'Fullstack Developer',
  'Software Development Engineer (SDE)',
  'Backend Engineer',
  'Frontend Engineer',
  'Data / ML Engineer',
  'DevOps & Cloud Engineer',
  'Product Manager',
];

export default function InterviewSetupPage() {
  const router = useRouter();
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [targetRole, setTargetRole] = useState('Fullstack Developer');
  const [questionCount, setQuestionCount] = useState(5);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    api.get('/resumes')
      .then((res) => {
        const list = res.data.data || [];
        setResumes(list);
        if (list.length > 0) {
          setSelectedResumeId(list[0]._id);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!selectedResumeId) return;

    setIsStarting(true);
    try {
      const res = await api.post('/interview/sessions', {
        resumeId: selectedResumeId,
        targetRole,
        count: questionCount,
      });

      const { session } = res.data.data;
      router.push(`/interview/session/${session._id}`);
    } catch (err) {
      console.error('Failed to start interview:', err);
      setIsStarting(false);
    }
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8 max-w-3xl mx-auto">
          {/* Header */}
          <div className="p-6 border-3 border-[#1a1a1a] bg-[#0055ff] text-white shadow-brutal flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#ffcc00]">
                Interactive Q&A Simulation
              </span>
              <h1 className="font-headline font-black text-2xl sm:text-3xl uppercase">
                Mock Interview Setup
              </h1>
              <p className="text-xs text-blue-100 font-medium mt-1">
                Configure your role persona to synthesize resume-aware technical & behavioral questions.
              </p>
            </div>
            <div className="p-3 bg-white border-2 border-[#1a1a1a] text-[#1a1a1a] shadow-brutal">
              <Mic className="w-6 h-6 text-[#0055ff]" />
            </div>
          </div>

          {resumes.length === 0 && !loading ? (
            <div className="brutal-card p-8 text-center space-y-4">
              <FileText className="w-10 h-10 mx-auto text-gray-400" />
              <h3 className="font-headline font-black text-xl uppercase text-[#1a1a1a]">
                No Resume Found
              </h3>
              <p className="text-xs text-gray-600 max-w-sm mx-auto">
                Please upload a resume first so the Generator Agent can synthesize personalized questions tailored to your skills.
              </p>
              <Link href="/resume/upload" className="brutal-btn-primary px-5 py-2.5 text-xs inline-flex items-center gap-2">
                <span>Upload Resume Now</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="brutal-card p-6 border-3 border-[#1a1a1a]">
              <form onSubmit={handleStartSession} className="space-y-6">
                {/* Select Target Role */}
                <div>
                  <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-2">
                    1. Choose Interview Target Role
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {supportedRoles.map((role) => (
                      <button
                        type="button"
                        key={role}
                        onClick={() => setTargetRole(role)}
                        className={`p-3 border-2 font-headline font-black text-xs uppercase text-left transition-all ${
                          targetRole === role
                            ? 'bg-[#ffcc00] border-[#1a1a1a] shadow-brutal translate-x-0.5'
                            : 'bg-white border-[#1a1a1a] hover:bg-[#faf7f2]'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Select Base Resume */}
                <div>
                  <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                    2. Select Resume for Personalization
                  </label>
                  <select
                    value={selectedResumeId}
                    onChange={(e) => setSelectedResumeId(e.target.value)}
                    className="brutal-input w-full text-xs font-bold"
                  >
                    {resumes.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.title} (ATS Score: {r.atsScore?.score || 0}%)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Number of Questions */}
                <div>
                  <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                    3. Question Count
                  </label>
                  <div className="flex gap-3">
                    {[3, 5, 8].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setQuestionCount(count)}
                        className={`px-4 py-2 border-2 font-headline font-black text-xs uppercase ${
                          questionCount === count
                            ? 'bg-[#1a1a1a] text-white border-[#1a1a1a] shadow-brutal'
                            : 'bg-white border-[#1a1a1a] hover:bg-[#faf7f2]'
                        }`}
                      >
                        {count} Questions
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isStarting || !selectedResumeId}
                  className="brutal-btn-primary w-full py-4 text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#ffcc00]" />
                      <span>Generator Agent Synthesizing Question Bank...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Launch Live Mock Interview Session</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
