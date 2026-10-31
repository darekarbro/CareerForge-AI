import React, { useEffect, useState } from 'react';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../components/AppShell/AppShell';
import JobRoleCard from '../components/JobRoleCard/JobRoleCard';
import api from '../services/api';
import { Compass, Sparkles, FileText, Loader2, ShieldCheck } from 'lucide-react';

export default function JobsPage() {
  const [roles, setRoles] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [generatedLinksMap, setGeneratedLinksMap] = useState({});
  const [keywordsMap, setKeywordsMap] = useState({});
  const [generating, setGenerating] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    Promise.all([
      api.get('/jobs/roles'),
      api.get('/resumes'),
    ])
      .then(([rolesRes, resumesRes]) => {
        setRoles(rolesRes.data.data || []);
        const resList = (resumesRes.data.data || []).filter((resume) => resume.processingStatus === 'COMPLETED');
        setResumes(resList);
        if (resList.length > 0) {
          setSelectedResumeId(resList[0]._id);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleGenerateCustomLinks = async (targetRole) => {
    const key = selectedResumeId + ':' + targetRole;
    if (generating[key]) return;
    setGenerating((previous) => ({ ...previous, [key]: true }));
    setErrors((previous) => ({ ...previous, [key]: '' }));
    try {
      const res = await api.post('/jobs/search-links', {
        targetRole,
        resumeId: selectedResumeId || undefined,
      });

      const { links, generatedKeywords } = res.data.data;
      setGeneratedLinksMap((prev) => ({ ...prev, [key]: links }));
      setKeywordsMap((prev) => ({ ...prev, [key]: generatedKeywords }));
    } catch (err) {
      setErrors((previous) => ({ ...previous, [key]: err.response?.data?.message || 'Unable to generate links. Please retry.' }));
    } finally { setGenerating((previous) => ({ ...previous, [key]: false })); }
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

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8 max-w-6xl mx-auto">
          {/* Header Banner */}
          <div className="p-6 border-3 border-[#1a1a1a] bg-[#ffcc00] shadow-brutal flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-800">
                Direct Platform Query Engine
              </span>
              <h1 className="font-headline font-black text-2xl sm:text-3xl uppercase text-[#1a1a1a]">
                Job Search Hub
              </h1>
              <p className="text-xs text-gray-800 font-bold mt-1 max-w-2xl leading-relaxed">
                Curated, resume-aware search queries pre-filtered across LinkedIn, Internshala, Naukri, and Indeed. No bots, scraping, or login credentials required.
              </p>
            </div>

            <div className="p-3 bg-white border-2 border-[#1a1a1a] text-[#1a1a1a] shadow-brutal">
              <Compass className="w-6 h-6 text-[#0055ff]" />
            </div>
          </div>

          {/* Resume Keyword Selector Toolbar */}
          {resumes.length > 0 && (
            <div className="p-4 border-2 border-[#1a1a1a] bg-white shadow-brutal flex flex-wrap items-center justify-between gap-4 text-xs font-bold">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0055ff]" />
                <span className="font-headline uppercase text-[#1a1a1a]">
                  Inject Skills From Resume:
                </span>
                <select
                  aria-label="Resume for job search skills"
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  className="brutal-input py-1 text-xs font-bold"
                >
                  {resumes.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-gray-500 font-medium uppercase text-[11px]">
                Clicking links opens live search results in a new tab
              </span>
            </div>
          )}

          {/* Role Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role) => (
              <JobRoleCard
                key={role.id}
                role={role}
                generatedLinks={generatedLinksMap[selectedResumeId + ':' + role.title]}
                keywords={keywordsMap[selectedResumeId + ':' + role.title]}
                isGenerating={generating[selectedResumeId + ':' + role.title]}
                error={errors[selectedResumeId + ':' + role.title]}
                onGenerateCustom={() => handleGenerateCustomLinks(role.title)}
              />
            ))}
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
