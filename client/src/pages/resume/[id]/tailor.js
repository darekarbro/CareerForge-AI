import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ProtectedRoute from '../../../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../../../components/AppShell/AppShell';
import ResumeDiffView from '../../../components/ResumeDiffView/ResumeDiffView';
import api from '../../../services/api';
import { Sparkles, Download, ArrowLeft, Loader2, CheckCircle2, FileText } from 'lucide-react';

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
  const { id } = router.query;

  const [resume, setResume] = useState(null);
  const [selectedRole, setSelectedRole] = useState('Fullstack Developer');
  const [customRole, setCustomRole] = useState('');
  const [jdText, setJdText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [tailoredResult, setTailoredResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/resumes/${id}`)
      .then((res) => {
        setResume(res.data.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  const handleTailorSubmit = async (e) => {
    e.preventDefault();
    const finalRole = selectedRole === 'Custom Role' ? customRole : selectedRole;
    if (!finalRole.trim()) return;

    setIsGenerating(true);
    try {
      const res = await api.post(`/resumes/${id}/tailor`, {
        targetRole: finalRole,
        jobDescriptionText: jdText,
      });
      setTailoredResult(res.data.data.tailoredResume);
    } catch (err) {
      console.error('Tailoring error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

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

  const activeTargetRole = selectedRole === 'Custom Role' ? customRole : selectedRole;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8 max-w-5xl mx-auto">
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
                Role-Aware Resume Tailor
              </h1>
              <p className="text-xs text-gray-600 font-medium">
                Re-engineer action verbs, inject ATS keywords, and compute side-by-side diff.
              </p>
            </div>

            {tailoredResult && (
              <a
                href={`http://localhost:5000/api/resumes/${id}/download/${tailoredResult._id}`}
                target="_blank"
                rel="noreferrer"
                className="brutal-btn-yellow px-4 py-2 text-xs flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Tailored PDF</span>
              </a>
            )}
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
                  disabled={isGenerating}
                  className="brutal-btn-primary w-full py-3.5 text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#ffcc00]" />
                      <span>Generator Agent Rewriting Highlights & Ingesting Keywords...</span>
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
                  Tailoring Complete • Served by [{tailoredResult.aiProvider}]
                </span>
                <button
                  onClick={() => setTailoredResult(null)}
                  className="text-xs font-bold uppercase underline hover:text-[#e63b2e]"
                >
                  Tailor for another role
                </button>
              </div>

              <ResumeDiffView
                diff={tailoredResult.diffFromOriginal}
                originalResume={resume}
                tailoredContent={tailoredResult.tailoredContent}
                targetRole={tailoredResult.targetRole}
              />
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
