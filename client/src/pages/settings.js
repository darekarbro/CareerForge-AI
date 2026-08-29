import React, { useEffect, useState } from 'react';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../components/AppShell/AppShell';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { Settings, Cpu, ShieldCheck, User, Save, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [providerHealth, setProviderHealth] = useState(null);
  const [profileData, setProfileData] = useState({
    name: '',
    targetRolePreference: '',
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        targetRolePreference: user.targetRolePreference || 'Fullstack Developer',
      });
    }

    api.get('/processing-jobs/health/providers')
      .then((res) => {
        setProviderHealth(res.data.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await api.put('/auth/me', profileData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Update profile error:', err);
    }
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8 max-w-4xl mx-auto">
          {/* Header */}
          <div className="pb-4 border-b-3 border-[#1a1a1a] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Configuration
              </span>
              <h1 className="font-headline font-black text-3xl uppercase tracking-tight text-[#1a1a1a]">
                System & Profile Settings
              </h1>
            </div>
            <div className="p-2.5 bg-[#ffcc00] border-2 border-[#1a1a1a] shadow-brutal">
              <Settings className="w-5 h-5 text-[#1a1a1a]" />
            </div>
          </div>

          {/* AI Providers Health Diagnostics */}
          <div className="brutal-card p-6 border-3 border-[#1a1a1a] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1a1a]">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-[#0055ff]" />
                <h3 className="font-headline font-black text-base uppercase text-[#1a1a1a]">
                  AI Provider Health & Fallback Status
                </h3>
              </div>
              <span className="px-2.5 py-0.5 bg-[#1a1a1a] text-[#ffcc00] border-2 border-[#1a1a1a] font-headline font-black text-[10px] uppercase">
                Active: {providerHealth?.activeProvider || 'deterministic-fallback'}
              </span>
            </div>

            <p className="text-xs text-gray-600 font-medium leading-relaxed">
              The agentic engine executes requests through a prioritized fallback order: OpenRouter → Gemini → Deterministic Rule-Based Fallback.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* OpenRouter */}
              <div className="p-4 border-2 border-[#1a1a1a] bg-white shadow-brutal space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-headline font-bold text-xs uppercase text-[#1a1a1a]">
                    1. OpenRouter
                  </h4>
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-black uppercase border ${
                      providerHealth?.openrouter?.configured
                        ? 'bg-green-100 text-green-900 border-green-800'
                        : 'bg-gray-100 text-gray-600 border-gray-400'
                    }`}
                  >
                    {providerHealth?.openrouter?.configured ? 'Configured' : 'Offline'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 font-mono">
                  {providerHealth?.openrouter?.model || 'meta-llama/llama-3.3-70b-instruct:free'}
                </p>
              </div>

              {/* Gemini */}
              <div className="p-4 border-2 border-[#1a1a1a] bg-white shadow-brutal space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-headline font-bold text-xs uppercase text-[#1a1a1a]">
                    2. Google Gemini
                  </h4>
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-black uppercase border ${
                      providerHealth?.gemini?.configured
                        ? 'bg-green-100 text-green-900 border-green-800'
                        : 'bg-gray-100 text-gray-600 border-gray-400'
                    }`}
                  >
                    {providerHealth?.gemini?.configured ? 'Configured' : 'Offline'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 font-mono">
                  {providerHealth?.gemini?.model || 'gemini-1.5-flash'}
                </p>
              </div>

              {/* Deterministic */}
              <div className="p-4 border-2 border-[#1a1a1a] bg-[#ffcc00]/20 shadow-brutal space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-headline font-bold text-xs uppercase text-[#1a1a1a]">
                    3. Rule-Based Fallback
                  </h4>
                  <span className="px-1.5 py-0.5 text-[9px] font-black uppercase bg-green-200 text-green-950 border border-green-800">
                    Always Online
                  </span>
                </div>
                <p className="text-[11px] text-gray-700 font-medium">
                  Regex parser, STAR evaluator, heuristic ATS scoring
                </p>
              </div>
            </div>
          </div>

          {/* Profile Management Card */}
          <div className="brutal-card p-6 border-3 border-[#1a1a1a] space-y-6">
            <h3 className="font-headline font-black text-base uppercase text-[#1a1a1a] pb-3 border-b-2 border-[#1a1a1a] flex items-center gap-2">
              <User className="w-4 h-4 text-[#0055ff]" />
              <span>Candidate Profile & Preferences</span>
            </h3>

            {saveSuccess && (
              <div className="p-3 border-2 border-[#1a1a1a] bg-green-100 text-green-900 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Profile updated successfully!</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="brutal-input w-full text-xs"
                />
              </div>

              <div>
                <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                  Email (Read-only)
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="brutal-input w-full text-xs bg-gray-100 opacity-70 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                  Default Target Role
                </label>
                <select
                  value={profileData.targetRolePreference}
                  onChange={(e) => setProfileData({ ...profileData, targetRolePreference: e.target.value })}
                  className="brutal-input w-full text-xs font-bold"
                >
                  <option value="Fullstack Developer">Fullstack Developer</option>
                  <option value="Software Development Engineer (SDE)">Software Development Engineer (SDE)</option>
                  <option value="Backend Engineer">Backend Engineer</option>
                  <option value="Frontend Engineer">Frontend Engineer</option>
                  <option value="Data / ML Engineer">Data / ML Engineer</option>
                  <option value="DevOps & Cloud Engineer">DevOps & Cloud Engineer</option>
                  <option value="Product Manager">Product Manager</option>
                </select>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="brutal-btn-primary px-6 py-2.5 text-xs flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
