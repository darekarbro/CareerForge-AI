import React, { useEffect, useState } from 'react';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../components/AppShell/AppShell';
import ApplicationBoard from '../components/ApplicationBoard/ApplicationBoard';
import api from '../services/api';
import { KanbanSquare, TrendingUp, Award, Layers, Loader2 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export default function ApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchApplicationsData = async () => {
    try {
      const [appsRes, anaRes] = await Promise.all([
        api.get('/applications'),
        api.get('/applications/analytics'),
      ]);
      setApplications(appsRes.data.data || []);
      setAnalytics(anaRes.data.data);
    } catch (err) {
      console.error('Error fetching applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicationsData();
  }, []);

  const handleAddApplication = async (formData) => {
    try {
      const res = await api.post('/applications', formData);
      setApplications((prev) => [res.data.data, ...prev]);
      fetchApplicationsData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateApplication = async (appId, formData) => {
    try {
      const res = await api.put(`/applications/${appId}`, formData);
      setApplications((prev) =>
        prev.map((a) => (a._id === appId ? res.data.data : a))
      );
      fetchApplicationsData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteApplication = async (appId) => {
    try {
      await api.delete(`/applications/${appId}`);
      setApplications((prev) => prev.filter((a) => a._id !== appId));
      fetchApplicationsData();
    } catch (err) {
      console.error(err);
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

  const conversion = analytics?.conversionRates || {};
  const weeklyData = analytics?.weeklyVolume || [
    { week: 'Week 1', applications: 4 },
    { week: 'Week 2', applications: 8 },
    { week: 'Week 3', applications: 12 },
  ];

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8 max-w-7xl mx-auto">
          {/* Funnel Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="brutal-card p-4 border-l-8 border-l-[#ffcc00]">
              <span className="text-[10px] font-black uppercase text-gray-600 block">
                Applied → OA Rate
              </span>
              <span className="font-headline font-black text-2xl text-[#1a1a1a]">
                {conversion.appliedToOa || 0}%
              </span>
            </div>

            <div className="brutal-card p-4 border-l-8 border-l-[#0055ff]">
              <span className="text-[10px] font-black uppercase text-gray-600 block">
                OA → Interview Rate
              </span>
              <span className="font-headline font-black text-2xl text-[#1a1a1a]">
                {conversion.oaToInterview || 0}%
              </span>
            </div>

            <div className="brutal-card p-4 border-l-8 border-l-purple-600">
              <span className="text-[10px] font-black uppercase text-gray-600 block">
                Interview → Offer Rate
              </span>
              <span className="font-headline font-black text-2xl text-[#1a1a1a]">
                {conversion.interviewToOffer || 0}%
              </span>
            </div>

            <div className="brutal-card p-4 border-l-8 border-l-green-600">
              <span className="text-[10px] font-black uppercase text-gray-600 block">
                Overall Pipeline Yield
              </span>
              <span className="font-headline font-black text-2xl text-[#1a1a1a]">
                {conversion.overallConversion || 0}%
              </span>
            </div>
          </div>

          {/* Kanban Board */}
          <ApplicationBoard
            applications={applications}
            onAddApplication={handleAddApplication}
            onUpdateApplication={handleUpdateApplication}
            onDeleteApplication={handleDeleteApplication}
          />

          {/* Applications Volume Chart */}
          <div className="brutal-card p-6">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1a1a] mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#0055ff]" />
                <h3 className="font-headline font-black text-base uppercase text-[#1a1a1a]">
                  Application Velocity & Volume
                </h3>
              </div>
              <span className="text-[10px] font-black uppercase text-gray-500 bg-[#f5f0e8] px-2 py-0.5 border border-[#1a1a1a]">
                Weekly Distribution
              </span>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e3da" />
                  <XAxis dataKey="week" stroke="#1a1a1a" fontSize={11} fontWeight={700} />
                  <YAxis stroke="#1a1a1a" fontSize={11} fontWeight={700} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '2px solid #1a1a1a',
                      boxShadow: '4px 4px 0px #1a1a1a',
                      fontSize: '11px',
                      fontWeight: 'bold',
                    }}
                  />
                  <Bar dataKey="applications" fill="#1a1a1a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
