import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ProtectedRoute from '../../../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../../../components/AppShell/AppShell';
import api from '../../../services/api';
import {
  FileText,
  Sparkles,
  Award,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  Trash2,
  Loader2,
  Compass,
} from 'lucide-react';

export default function ResumeDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [resume, setResume] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [atsScore, setAtsScore] = useState(null);

  // Gap Analysis Modal State
  const [jdModalOpen, setJdModalOpen] = useState(false);
  const [jdText, setJdText] = useState('');
  const [targetRole, setTargetRole] = useState('Fullstack Developer');
  const [gapResult, setGapResult] = useState(null);
  const [gapLoading, setGapLoading] = useState(false);

  const fetchResumeData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/resumes/${id}`);
      setResume(res.data.data);
      setAtsScore(res.data.data.atsScore);

      const verRes = await api.get(`/resumes/${id}/versions`);
      setVersions(verRes.data.data || []);
    } catch (err) {
      console.error('Error fetching resume:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResumeData();
  }, [id]);

  const handleRunGapAnalysis = async (e) => {
    e.preventDefault();
    if (!jdText.trim()) return;

    setGapLoading(true);
    try {
      const res = await api.post(`/resumes/${id}/gap-analysis`, {
        jobDescriptionText: jdText,
        targetRole,
      });
      setGapResult(res.data.data.gapAnalysis);
    } catch (err) {
      console.error('Gap analysis error:', err);
    } finally {
      setGapLoading(false);
    }
  };

  const handleDeleteResume = async () => {
    if (confirm('Are you sure you want to delete this resume and its tailored versions?')) {
      try {
        await api.delete(`/resumes/${id}`);
        router.push('/dashboard');
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AppShell>
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#0055ff]" />
            <span className="font-headline font-black uppercase text-xs">Loading Resume Data...</span>
          </div>
        </AppShell>
      </ProtectedRoute>
    );
  }

  if (!resume) {
    return (
      <ProtectedRoute>
        <AppShell>
          <div className="py-20 text-center space-y-4">
            <h2 className="font-headline font-black text-2xl uppercase">Resume Not Found</h2>
            <Link href="/dashboard" className="brutal-btn-primary px-4 py-2 text-xs">
              Back to Dashboard
            </Link>
          </div>
        </AppShell>
      </ProtectedRoute>
    );
  }

  const parsed = resume.parsedData || {};
  const contact = parsed.contactInfo || {};

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8 max-w-6xl mx-auto">
          {/* Header Banner */}
          <div className="p-6 border-3 border-[#1a1a1a] bg-[#ffcc00] shadow-brutal flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-800">
                Primary Resume Artifact
              </span>
              <h1 className="font-headline font-black text-2xl sm:text-3xl uppercase text-[#1a1a1a]">
                {resume.title}
              </h1>
              <p className="text-xs text-gray-800 font-bold mt-1">
                {contact.name || 'Candidate'} • {contact.email || 'No email parsed'} • {contact.phone || 'No phone parsed'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/resume/${resume._id}/tailor`}
                className="brutal-btn-primary px-4 py-2.5 text-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>Tailor For Role</span>
              </Link>
              <button
                onClick={() => setJdModalOpen(true)}
                className="brutal-btn-blue px-4 py-2.5 text-xs flex items-center gap-1.5"
              >
                <Layers className="w-4 h-4" />
                <span>Run JD Gap Analysis</span>
              </button>
              <button
                onClick={handleDeleteResume}
                className="p-2.5 border-2 border-[#1a1a1a] bg-white hover:bg-[#e63b2e] hover:text-white shadow-brutal transition-all"
                title="Delete Resume"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ATS Scorecard Banner */}
          <div className="brutal-card p-6 border-3 border-[#1a1a1a]">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b-2 border-[#1a1a1a]">
              <div className="flex items-center gap-3">
                <div className="p-3 border-2 border-[#1a1a1a] bg-[#0055ff] text-white shadow-brutal">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-headline font-black text-lg uppercase text-[#1a1a1a]">
                    ATS Compatibility Breakdown
                  </h3>
                  <p className="text-xs text-gray-600 font-medium">
                    Evaluated against section hierarchy, keyword density, and formatting rules.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-headline font-black text-4xl text-[#1a1a1a]">
                  {atsScore?.score || 0}%
                </span>
              </div>
            </div>

            {/* Score Metrics Sub-Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
              <div className="p-3 border-2 border-[#1a1a1a] bg-[#f5f0e8] text-center">
                <span className="text-[10px] font-black uppercase text-gray-600 block">Structure</span>
                <span className="font-headline font-black text-xl text-[#1a1a1a]">
                  {atsScore?.structureScore || 0}%
                </span>
              </div>
              <div className="p-3 border-2 border-[#1a1a1a] bg-[#f5f0e8] text-center">
                <span className="text-[10px] font-black uppercase text-gray-600 block">Keywords</span>
                <span className="font-headline font-black text-xl text-[#1a1a1a]">
                  {atsScore?.keywordScore || 0}%
                </span>
              </div>
              <div className="p-3 border-2 border-[#1a1a1a] bg-[#f5f0e8] text-center">
                <span className="text-[10px] font-black uppercase text-gray-600 block">Formatting</span>
                <span className="font-headline font-black text-xl text-[#1a1a1a]">
                  {atsScore?.formattingScore || 0}%
                </span>
              </div>
              <div className="p-3 border-2 border-[#1a1a1a] bg-[#f5f0e8] text-center">
                <span className="text-[10px] font-black uppercase text-gray-600 block">Length</span>
                <span className="font-headline font-black text-xl text-[#1a1a1a]">
                  {atsScore?.lengthScore || 0}%
                </span>
              </div>
            </div>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 border-2 border-[#1a1a1a] bg-green-50">
                <span className="font-headline font-black uppercase text-green-900 flex items-center gap-1.5 mb-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-700" />
                  ATS Strengths
                </span>
                <ul className="space-y-1">
                  {(atsScore?.strengths || ['Clean section headings']).map((s, idx) => (
                    <li key={idx} className="text-green-950 font-medium leading-tight">• {s}</li>
                  ))}
                </ul>
              </div>
              <div className="p-3 border-2 border-[#1a1a1a] bg-amber-50">
                <span className="font-headline font-black uppercase text-amber-900 flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  Recommended Optimizations
                </span>
                <ul className="space-y-1">
                  {(atsScore?.improvements || ['Expand on quantifiable impact bullets']).map((imp, idx) => (
                    <li key={idx} className="text-amber-950 font-medium leading-tight">• {imp}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Tailored Versions History */}
          {versions.length > 0 && (
            <div className="brutal-card p-6">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1a1a] mb-4">
                <h3 className="font-headline font-black text-base uppercase text-[#1a1a1a]">
                  Tailored Versions ({versions.length})
                </h3>
                <Link
                  href={`/resume/${resume._id}/tailor`}
                  className="text-xs font-bold text-[#0055ff] hover:underline uppercase"
                >
                  + Generate New Version
                </Link>
              </div>

              <div className="space-y-3">
                {versions.map((ver) => (
                  <div
                    key={ver._id}
                    className="p-4 border-2 border-[#1a1a1a] bg-white shadow-brutal flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-[#1a1a1a] text-[#ffcc00] font-black text-[10px] uppercase">
                          v{ver.version}
                        </span>
                        <h4 className="font-headline font-black text-sm uppercase text-[#1a1a1a]">
                          {ver.targetRole}
                        </h4>
                      </div>
                      <span className="text-[11px] text-gray-500 font-medium">
                        Generated {new Date(ver.createdAt).toLocaleDateString()} via {ver.aiProvider}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`http://localhost:5000/api/resumes/${resume._id}/download/${ver._id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="brutal-btn-yellow px-3 py-1.5 text-xs flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF Export</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Structured Resume Content Preview */}
          <div className="brutal-card p-6 space-y-6">
            <h3 className="font-headline font-black text-xl uppercase text-[#1a1a1a] pb-3 border-b-2 border-[#1a1a1a]">
              Structured Resume Content
            </h3>

            {/* Summary */}
            {parsed.summary && (
              <div>
                <h4 className="font-headline font-black text-xs uppercase text-[#0055ff] mb-1">
                  Professional Summary
                </h4>
                <p className="text-xs text-gray-800 leading-relaxed font-medium p-3 border-2 border-[#1a1a1a] bg-[#faf7f2]">
                  {parsed.summary}
                </p>
              </div>
            )}

            {/* Skills */}
            <div>
              <h4 className="font-headline font-black text-xs uppercase text-[#0055ff] mb-2">
                Technical Competencies
              </h4>
              <div className="flex flex-wrap gap-2">
                {(parsed.skills?.all || []).map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 border-2 border-[#1a1a1a] bg-white font-bold text-xs shadow-brutal uppercase text-[#1a1a1a]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Work History */}
            <div>
              <h4 className="font-headline font-black text-xs uppercase text-[#0055ff] mb-3">
                Experience Record
              </h4>
              <div className="space-y-3">
                {(parsed.workExperience || []).map((exp, idx) => (
                  <div key={idx} className="p-4 border-2 border-[#1a1a1a] bg-[#faf7f2] space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-headline font-black text-sm uppercase text-[#1a1a1a]">
                          {exp.role}
                        </h5>
                        <span className="text-xs font-bold text-[#0055ff]">{exp.company}</span>
                      </div>
                      <span className="text-[11px] font-bold text-gray-500 uppercase">
                        {exp.startDate} - {exp.endDate || 'Present'}
                      </span>
                    </div>
                    <ul className="space-y-1 text-xs text-gray-800">
                      {(exp.highlights || []).map((bullet, bidx) => (
                        <li key={bidx} className="leading-snug">• {bullet}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Gap Analysis Modal */}
        {jdModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-2xl bg-[#f5f0e8] border-4 border-[#1a1a1a] shadow-brutal-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1a1a]">
                <h3 className="font-headline font-black text-lg uppercase text-[#1a1a1a]">
                  Job Description Gap Analysis
                </h3>
                <button
                  onClick={() => {
                    setJdModalOpen(false);
                    setGapResult(null);
                  }}
                  className="px-2 py-1 border-2 border-[#1a1a1a] bg-white font-black text-xs"
                >
                  ✕
                </button>
              </div>

              {!gapResult ? (
                <form onSubmit={handleRunGapAnalysis} className="space-y-4">
                  <div>
                    <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                      Target Role Title
                    </label>
                    <input
                      type="text"
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      className="brutal-input w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                      Paste Target Job Description (JD)
                    </label>
                    <textarea
                      rows={8}
                      required
                      value={jdText}
                      onChange={(e) => setJdText(e.target.value)}
                      placeholder="Paste the full job posting requirements, must-have qualifications, and tech stack..."
                      className="brutal-input w-full text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={gapLoading || !jdText.trim()}
                      className="brutal-btn-primary px-6 py-2.5 text-xs flex items-center gap-2 disabled:opacity-50"
                    >
                      {gapLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#ffcc00]" />
                          <span>Analyzer Agent Running Gap Matrix...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Run JD Gap Comparison</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  {/* Match Score Banner */}
                  <div className="p-4 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-between shadow-brutal">
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-800">
                        Match Score Matrix
                      </span>
                      <h4 className="font-headline font-black text-xl uppercase text-[#1a1a1a]">
                        {targetRole}
                      </h4>
                    </div>
                    <span className="font-headline font-black text-3xl text-[#1a1a1a]">
                      {gapResult.matchScore}%
                    </span>
                  </div>

                  {/* Matched Skills */}
                  <div className="p-3 border-2 border-[#1a1a1a] bg-white">
                    <span className="font-headline font-black text-xs uppercase text-[#0055ff] block mb-2">
                      Matched Skills & Resume Citations:
                    </span>
                    <div className="space-y-2 text-xs">
                      {(gapResult.matchedSkills || []).map((m, idx) => (
                        <div key={idx} className="p-2 border border-gray-300 bg-[#f5f0e8]">
                          <span className="font-black text-[#1a1a1a] uppercase">{m.skill}</span>
                          <p className="text-[11px] text-gray-600 mt-0.5">
                            {m.supportingResumeLines?.[0]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Missing Must-Haves */}
                  {(gapResult.mustHaveMissing || []).length > 0 && (
                    <div className="p-3 border-2 border-[#1a1a1a] bg-[#ffdad6]">
                      <span className="font-headline font-black text-xs uppercase text-[#93000a] block mb-1">
                        Critical Missing Criteria:
                      </span>
                      <ul className="space-y-1 text-xs text-gray-900">
                        {gapResult.mustHaveMissing.map((item, idx) => (
                          <li key={idx} className="font-medium">
                            • <strong className="uppercase">{item.skill}</strong>: {item.recommendation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setGapResult(null)}
                      className="px-4 py-2 border-2 border-[#1a1a1a] bg-white font-headline font-bold text-xs uppercase"
                    >
                      Compare Another JD
                    </button>
                    <Link
                      href={`/resume/${resume._id}/tailor`}
                      className="brutal-btn-primary px-5 py-2 text-xs flex items-center gap-1"
                    >
                      <span>Tailor Resume Now</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </AppShell>
    </ProtectedRoute>
  );
}
