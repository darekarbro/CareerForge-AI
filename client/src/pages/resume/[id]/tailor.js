import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ProtectedRoute from '../../../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../../../components/AppShell/AppShell';
import ReviewEditor from '../../../components/ResumeEditor/ReviewEditor';
import api from '../../../services/api';
import { submitProcessingRequest } from '../../../services/processing';
import { useAuthStore } from '../../../store/authStore';
import { Sparkles, ArrowLeft, Loader2 } from 'lucide-react';

const supportedRoles = [
  'Fullstack Developer',
  'Software Development Engineer (SDE)',
  'Backend Engineer',
  'Frontend Engineer',
  'Data / ML Engineer',
  'DevOps & Cloud Engineer',
  'Product Manager',
  'Custom Role',
];

export default function ResumeTailorPage() {
  const router = useRouter();
  const { id, version } = router.query;
  const userId = useAuthStore((state) => state.user?.id || state.user?._id);

  const [resume, setResume] = useState(null);
  const [selectedRole, setSelectedRole] = useState('Fullstack Developer');
  const [customRole, setCustomRole] = useState('');
  const [jdText, setJdText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [tailoredResult, setTailoredResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id || !userId) return;
    const controller = new AbortController(); setLoading(true); setResume(null); setTailoredResult(null);
    api.get(`/resumes/${id}`, { signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) setResume(res.data.data);
      })
      .catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || 'Unable to load your resume'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, userId]);
  useEffect(() => {
    if (!id || !version) return;
    const controller = new AbortController();
    api.get(`/resumes/${id}/versions/${version}`, { signal: controller.signal }).then((response) => { if (!controller.signal.aborted) setTailoredResult(response.data.data); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.response?.data?.message || 'Unable to load this version'); });
    return () => controller.abort();
  }, [id, version, userId]);

  const handleTailorSubmit = async (e) => {
    e.preventDefault();
    const finalRole = selectedRole === 'Custom Role' ? customRole : selectedRole;
    if (!finalRole.trim()) return;

    setIsGenerating(true);
    setError('');
    try {
      const res = await submitProcessingRequest(`/resumes/${id}/tailor`, {
        targetRole: finalRole,
        jobDescriptionText: jdText,
      });
      if (userId === (useAuthStore.getState().user?.id || useAuthStore.getState().user?._id)) setTailoredResult(res.data.data.tailoredResume);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to tailor this resume');
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading || resume && String(resume.owner) !== userId) {
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

  const activeTargetRole = selectedRole === 'Custom Role' ? customRole : selectedRole;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8 max-w-5xl mx-auto">
          {error && <p role="alert" className="p-3 border-2 border-red-800 bg-red-50 text-red-900 text-sm">{error}</p>}
          {resume?.processingStatus !== 'COMPLETED' && <p role="status" className="brutal-card p-4 text-sm">Wait for parsing to complete in the resume details page before tailoring.</p>}
          {/* Top Bar Navigation */}
          <div className="pb-4 border-b-3 border-[#1a1a1a] flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link
                href={`/resume/${id}`}
                className="text-xs font-bold text-[#0055ff] hover:underline uppercase flex items-center gap-1 mb-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Resume Details
              </Link>
              <h1 className="font-headline font-black text-3xl uppercase tracking-tight text-[#1a1a1a]">
                Tailor your resume
              </h1>
              <p className="text-xs text-gray-600 font-medium">
                Build a detailed resume with clear achievements, project contributions and relevant skills from your experience.
              </p>
            </div>

          </div>

          {!tailoredResult ? (
            /* Setup Form */
            <div className="brutal-card p-6 border-3 border-[#1a1a1a]">
              <form onSubmit={handleTailorSubmit} className="space-y-6">
                <div>
                  <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-2">
                    Select Target Role Persona
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {supportedRoles.map((role) => (
                      <button
                        type="button"
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={`p-3 border-2 font-headline font-black text-xs uppercase text-left transition-all ${
                          selectedRole === role
                            ? 'bg-[#ffcc00] border-[#1a1a1a] shadow-brutal translate-x-0.5'
                            : 'bg-white border-[#1a1a1a] hover:bg-[#faf7f2]'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedRole === 'Custom Role' && (
                  <div>
                    <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                      Custom Role Title
                    </label>
                    <input
                      type="text"
                      required
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      placeholder="e.g. AI Systems Architect, Mobile Platform Lead"
                      className="brutal-input w-full text-xs"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                    Job Description (Optional — for deep keyword matching)
                  </label>
                  <textarea
                    rows={6}
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    placeholder="Paste specific job requirements or responsibilities here to align bullet points..."
                    className="brutal-input w-full text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isGenerating || resume?.processingStatus !== 'COMPLETED'}
                  className="brutal-btn-primary w-full py-3.5 text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#ffcc00]" />
                      <span>Writing your detailed, role-specific resume...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Role-Tailored Resume</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Diff Result View */
            <div className="space-y-6">
              <div className="flex items-center justify-between p-3 border-2 border-[#1a1a1a] bg-white">
                <span className="font-headline font-black text-xs uppercase text-[#0055ff]">
                  Resume ready for your review
                </span>
                <button
                  onClick={() => setTailoredResult(null)}
                  className="text-xs font-bold uppercase underline hover:text-[#e63b2e]"
                >
                  Tailor for another role
                </button>
              </div>

              <ReviewEditor key={tailoredResult._id} version={tailoredResult} onSaved={setTailoredResult} />
              {tailoredResult.sourceRevision < (resume?.contentRevision || 1) && <p role="status" className="p-4 bg-amber-50 text-sm">This version uses original resume revision {tailoredResult.sourceRevision}. The original is now revision {resume.contentRevision}. Tailor again to include your latest verified facts.</p>}
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
