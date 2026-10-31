import React from 'react';
import Link from 'next/link';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../components/AppShell/AppShell';
import MetricGrid from '../components/MetricGrid/MetricGrid';
import useOwnedResource from '../hooks/useOwnedResource';
import { useAuthStore } from '../store/authStore';
export function nextAction(metrics) {
  if (!metrics.totalResumes) return { label: 'Add your first resume', detail: 'Upload a resume or build one from your verified career profile.', href: '/onboarding' };
  if (!metrics.verifiedResumeCount) return { label: 'Verify your resume', detail: 'Check the extracted facts and add your contributions, tools and results.', href: '/resume/' + metrics.nextResume + '/edit' };
  if (!metrics.totalWorkspaces) return { label: 'Choose a target job', detail: 'Save a job description to tailor your resume and prepare for that role.', href: '/workspaces' };
  if (!metrics.totalTailored) return { label: 'Tailor your resume', detail: 'Use your saved job description, then review each suggestion.', href: '/workspaces/' + metrics.nextWorkspace };
  if (!metrics.totalExports) return { label: 'Review and export', detail: 'Review your tailored version and choose the layout you want to send.', href: '/workspaces/' + metrics.nextWorkspace };
  return { label: 'Prepare for your next interview', detail: 'Practice with the same job description and focus on the topics that need work.', href: '/interview/setup?workspace=' + metrics.nextWorkspace };
}
export default function DashboardPage() {
  const { data: metrics, loading, error, reload } = useOwnedResource('/resumes/dashboard'), user = useAuthStore((state) => state.user);
  const next = metrics ? nextAction(metrics) : null;
  const steps = metrics ? [['Add resume', metrics.totalResumes > 0, '/resumes'], ['Verify facts', metrics.verifiedResumeCount > 0, '/resumes'], ['Choose job', metrics.totalWorkspaces > 0, '/workspaces'], ['Tailor', metrics.totalTailored > 0, '/workspaces'], ['Export', metrics.totalExports > 0, '/workspaces']] : [];
  return <ProtectedRoute><AppShell><div className="space-y-6 max-w-6xl mx-auto">
    <header className="brutal-card p-6 bg-[#ffcc00]"><h1 className="text-3xl font-bold">Welcome back, {user?.name || 'there'}</h1><p className="text-sm mt-2">Your next opportunity starts with a clear, accurate resume.</p></header>
    {loading ? <p role="status" className="brutal-card p-8">Loading your progress…</p> : error ? <p role="alert" className="brutal-card p-6">{error} <button onClick={() => reload()} className="underline">Retry</button></p> : metrics && <>
      <section className="brutal-card p-6 space-y-3"><h2 className="text-sm font-semibold text-gray-600">Your next step</h2><h3 className="text-2xl font-bold">{next.label}</h3><p className="text-sm">{next.detail}</p><Link href={next.href} className="brutal-btn-primary inline-block px-5 py-3 text-sm">Continue</Link></section>
      <ol aria-label="Resume journey" className="grid grid-cols-2 sm:grid-cols-5 gap-3">{steps.map(([label, done, href], index) => <li key={label} className={'border-2 p-3 text-sm ' + (done ? 'bg-green-50' : 'bg-white')}><Link href={href}>{done ? '✓' : index + 1} {label}<span className="sr-only">{done ? ', completed' : ', next step available'}</span></Link></li>)}</ol>
      <MetricGrid metrics={metrics} />
      <div className="grid md:grid-cols-2 gap-5">
        <section className="brutal-card p-5"><h2 className="text-xl font-bold mb-4">Recent resumes</h2>{!metrics.recentResumes?.length ? <p className="text-sm">No resumes yet. <Link className="underline" href="/profile">Build your career profile</Link>.</p> : <ul className="space-y-3">{metrics.recentResumes.map((resume) => <li key={resume._id} className="border-b pb-3"><Link href={'/resume/' + resume._id} className="font-semibold text-blue-700 underline">{resume.title}</Link><p className="text-sm text-gray-600">{resume.processingStatus === 'COMPLETED' ? resume.verifiedAt ? 'Verified' : 'Ready to verify' : resume.processingStatus.toLowerCase()}</p></li>)}</ul>}<Link href="/resumes" className="text-sm underline inline-block mt-4">All resumes</Link></section>
        <section className="brutal-card p-5"><h2 className="text-xl font-bold mb-4">Interview progress</h2>{!metrics.interviewTrends?.length ? <p className="text-sm">Complete a practice session to see your own progress here.</p> : <ol className="space-y-3">{metrics.interviewTrends.map((item, index) => <li key={index} className="text-sm flex gap-3 justify-between"><span>{item.role} · {new Date(item.date).toLocaleDateString()}</span><strong>{item.score}%</strong></li>)}</ol>}<Link href="/interview/history" className="underline text-sm inline-block mt-4">Practice history and focus topics</Link></section>
      </div>
      {!!metrics.dueApplications?.length && <section className="brutal-card p-5"><h2 className="text-xl font-bold mb-3">Deadlines and follow-ups</h2><ul className="space-y-2 text-sm">{metrics.dueApplications.map((item) => <li key={item._id}>{item.roleTitle} at {item.company} · {item.followUpAt ? 'Follow up ' + new Date(item.followUpAt).toLocaleDateString() : 'Deadline ' + new Date(item.deadline).toLocaleDateString()}</li>)}</ul><Link href="/applications?due=1" className="underline text-sm">Review upcoming actions</Link></section>}
      <section className="brutal-card p-5 text-sm"><h2 className="text-xl font-bold mb-3">Your progress</h2><p>{metrics.totalWorkspaces} saved jobs · {metrics.totalTailored} tailored versions · {metrics.totalExports} exports</p>{metrics.firstExportMinutes !== null && <p>First export completed {metrics.firstExportMinutes} minutes after joining.</p>}<Link href="/activity" className="underline inline-block mt-3">View processing activity and usage</Link></section>
    </>}
  </div></AppShell></ProtectedRoute>;
}
