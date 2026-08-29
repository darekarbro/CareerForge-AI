import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/authStore';
import {
  FileUp,
  Sparkles,
  Award,
  Mic,
  Compass,
  KanbanSquare,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers,
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#f5f0e8] text-[#1a1a1a] flex flex-col selection:bg-[#ffcc00] selection:text-[#1a1a1a]">
      {/* Bauhaus Top Navigation */}
      <header className="border-b-3 border-[#1a1a1a] bg-[#f5f0e8] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1a1a1a] border-2 border-[#1a1a1a] flex items-center justify-center text-[#ffcc00] font-headline font-black text-2xl shadow-brutal">
              C
            </div>
            <div>
              <span className="font-headline font-black text-2xl uppercase tracking-tight text-[#1a1a1a]">
                CareerForge<span className="text-[#0055ff]">.AI</span>
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 bg-[#ffcc00] border border-[#1a1a1a] text-[10px] font-black uppercase">
                Neo-Brutalist Career Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="brutal-btn-primary px-5 py-2 text-xs flex items-center gap-1.5"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 border-2 border-[#1a1a1a] bg-white font-headline font-bold text-xs uppercase hover:bg-gray-100 shadow-brutal transition-all"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="brutal-btn-primary px-5 py-2 text-xs flex items-center gap-1.5"
                >
                  <span>Start Free</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b-3 border-[#1a1a1a] py-16 lg:py-24 px-4 sm:px-8 bg-[#faf7f2]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#ffcc00] border-2 border-[#1a1a1a] shadow-brutal text-xs font-black uppercase tracking-wider">
              <Cpu className="w-4 h-4 text-[#1a1a1a]" />
              <span>Multi-Agent Career Acceleration Pipeline</span>
            </div>

            <h1 className="font-headline font-black text-4xl sm:text-6xl lg:text-7xl leading-[0.95] uppercase tracking-tight text-[#1a1a1a]">
              Turn One Resume Into A Full <span className="text-[#0055ff] underline decoration-[#1a1a1a]">Job Pipeline</span>.
            </h1>

            <p className="text-base sm:text-lg text-gray-800 font-medium max-w-2xl leading-relaxed">
              Parse, tailor for specific roles, compute ATS compatibility scores, run JD gap analysis, practice interactive AI mock interviews with 4-dimension scorecards, and track applications.
            </p>

            <div className="pt-2 flex flex-wrap gap-4">
              <Link
                href="/register"
                className="brutal-btn-primary px-8 py-4 text-sm sm:text-base flex items-center gap-2"
              >
                <span>Upload Resume & Start</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="brutal-btn-yellow px-8 py-4 text-sm sm:text-base flex items-center gap-2"
              >
                <span>Explore Live Demo</span>
              </Link>
            </div>

            <div className="pt-6 grid grid-cols-3 gap-4 border-t-2 border-[#1a1a1a] text-center sm:text-left">
              <div>
                <div className="font-headline font-black text-2xl sm:text-3xl text-[#1a1a1a]">6 Agents</div>
                <div className="text-[11px] font-bold uppercase text-gray-600">Cooperating Pipeline</div>
              </div>
              <div>
                <div className="font-headline font-black text-2xl sm:text-3xl text-[#0055ff]">100% Offline</div>
                <div className="text-[11px] font-bold uppercase text-gray-600">Fallback Resilience</div>
              </div>
              <div>
                <div className="font-headline font-black text-2xl sm:text-3xl text-[#e63b2e]">4 Dimensions</div>
                <div className="text-[11px] font-bold uppercase text-gray-600">Interview Rubric</div>
              </div>
            </div>
          </div>

          {/* Hero Visual Preview */}
          <div className="lg:col-span-5">
            <div className="brutal-card p-6 border-4 border-[#1a1a1a] shadow-brutal-xl bg-white space-y-4 transform rotate-1 hover:rotate-0 transition-transform">
              <div className="p-3 bg-[#1a1a1a] text-white flex items-center justify-between border-2 border-[#1a1a1a]">
                <span className="font-headline font-black text-xs uppercase text-[#ffcc00]">
                  Real-Time Timeline
                </span>
                <span className="text-[10px] font-mono bg-green-500 text-black px-1.5 font-bold uppercase">
                  ONLINE
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="p-2 border-2 border-[#1a1a1a] bg-[#ffcc00]/20 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-[#1a1a1a] text-[#ffcc00] font-black text-[9px]">
                    PARSER
                  </span>
                  <span>Extracted 14 skills & 2 roles</span>
                </div>
                <div className="p-2 border-2 border-[#1a1a1a] bg-[#0055ff]/20 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-[#0055ff] text-white font-black text-[9px]">
                    ANALYZER
                  </span>
                  <span>ATS Compatibility: 88/100</span>
                </div>
                <div className="p-2 border-2 border-[#1a1a1a] bg-[#e63b2e]/20 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-[#e63b2e] text-white font-black text-[9px]">
                    GENERATOR
                  </span>
                  <span>Tailored for Senior SDE</span>
                </div>
                <div className="p-2 border-2 border-[#1a1a1a] bg-green-100 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-green-800 text-white font-black text-[9px]">
                    EVALUATOR
                  </span>
                  <span>Scorecard: Clarity 92% • Tech 88%</span>
                </div>
              </div>

              <div className="p-3 border-2 border-[#1a1a1a] bg-[#ffcc00] text-center font-headline font-black text-xs uppercase">
                Form Follows Function — Bauhaus Neo-Brutalism
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-16 px-4 sm:px-8 max-w-7xl mx-auto w-full space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="font-headline font-black text-xs uppercase px-3 py-1 bg-[#0055ff] text-white border-2 border-[#1a1a1a] shadow-brutal inline-block">
            End-To-End Architecture
          </span>
          <h2 className="font-headline font-black text-3xl sm:text-5xl uppercase tracking-tight text-[#1a1a1a]">
            Everything Needed To Land The Role
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="brutal-card p-6 flex flex-col justify-between border-3 border-[#1a1a1a]">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-[#ffcc00] border-2 border-[#1a1a1a] flex items-center justify-center shadow-brutal">
                <FileUp className="w-5 h-5 text-[#1a1a1a]" />
              </div>
              <h3 className="font-headline font-black text-xl uppercase text-[#1a1a1a]">
                1. Resume Parsing & ATS
              </h3>
              <p className="text-xs text-gray-700 font-medium leading-relaxed">
                Extract contact information, work experience, and technical competencies automatically. Receive a detailed ATS breakdown score.
              </p>
            </div>
          </div>

          <div className="brutal-card p-6 flex flex-col justify-between border-3 border-[#1a1a1a]">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-[#0055ff] border-2 border-[#1a1a1a] flex items-center justify-center text-white shadow-brutal">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-headline font-black text-xl uppercase text-[#1a1a1a]">
                2. Role Tailoring & Diff
              </h3>
              <p className="text-xs text-gray-700 font-medium leading-relaxed">
                Generate customized versions for SDE, Fullstack, Backend, Frontend, Data/ML, DevOps, or Product with highlighted visual diffs and PDF export.
              </p>
            </div>
          </div>

          <div className="brutal-card p-6 flex flex-col justify-between border-3 border-[#1a1a1a]">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-[#e63b2e] border-2 border-[#1a1a1a] flex items-center justify-center text-white shadow-brutal">
                <Mic className="w-5 h-5" />
              </div>
              <h3 className="font-headline font-black text-xl uppercase text-[#1a1a1a]">
                3. Live Mock Interviews
              </h3>
              <p className="text-xs text-gray-700 font-medium leading-relaxed">
                Answer AI-generated technical and STAR behavioral questions. Get structured scorecards across Clarity, Relevance, Structure, and Tech depth.
              </p>
            </div>
          </div>

          <div className="brutal-card p-6 flex flex-col justify-between border-3 border-[#1a1a1a]">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-[#1a1a1a] border-2 border-[#1a1a1a] flex items-center justify-center text-[#ffcc00] shadow-brutal">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-headline font-black text-xl uppercase text-[#1a1a1a]">
                4. JD Gap Analysis
              </h3>
              <p className="text-xs text-gray-700 font-medium leading-relaxed">
                Paste any job description to discover matched skills and missing must-haves with specific citations to your resume text.
              </p>
            </div>
          </div>

          <div className="brutal-card p-6 flex flex-col justify-between border-3 border-[#1a1a1a]">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-[#ffcc00] border-2 border-[#1a1a1a] flex items-center justify-center text-[#1a1a1a] shadow-brutal">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="font-headline font-black text-xl uppercase text-[#1a1a1a]">
                5. Job Search Hub
              </h3>
              <p className="text-xs text-gray-700 font-medium leading-relaxed">
                Instant pre-filtered deep links to LinkedIn, Internshala, Naukri, and Indeed derived directly from your resume skills.
              </p>
            </div>
          </div>

          <div className="brutal-card p-6 flex flex-col justify-between border-3 border-[#1a1a1a]">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-[#0055ff] border-2 border-[#1a1a1a] flex items-center justify-center text-white shadow-brutal">
                <KanbanSquare className="w-5 h-5" />
              </div>
              <h3 className="font-headline font-black text-xl uppercase text-[#1a1a1a]">
                6. Application Tracker
              </h3>
              <p className="text-xs text-gray-700 font-medium leading-relaxed">
                Kanban status pipeline with funnel conversion rates and weekly analytics to track every active opportunity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-3 border-[#1a1a1a] bg-[#1a1a1a] text-white py-8 px-4 sm:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#ffcc00] border-2 border-white text-[#1a1a1a] font-headline font-black flex items-center justify-center text-lg">
              C
            </div>
            <span className="font-headline font-black text-lg uppercase tracking-tight text-white">
              CareerForge AI
            </span>
          </div>
          <p className="text-xs font-medium text-gray-400">
            Engineered with Next.js, Express, MongoDB, Socket.IO & Bauhaus Neo-Brutalist Architecture.
          </p>
        </div>
      </footer>
    </div>
  );
}
