import React, { useState } from 'react';
import Link from 'next/link';
import AppShell from '../components/AppShell/AppShell';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import useOwnedResource from '../hooks/useOwnedResource';
export default function ResumesPage() {
  const { data, loading, error, reload } = useOwnedResource('/resumes'), [search, setSearch] = useState('');
  const matches = (data || []).filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));
  return <ProtectedRoute><AppShell><div className="max-w-5xl mx-auto space-y-5"><h1 className="text-3xl font-bold">My resumes</h1>
    <div className="flex flex-wrap gap-3"><Link href="/resume/upload" className="brutal-btn-primary px-4 py-3 text-sm">Upload a resume</Link><Link href="/profile" className="brutal-btn-yellow px-4 py-3 text-sm">Create from my profile</Link></div>
    <label className="block text-sm font-semibold">Search resumes<input className="brutal-input block w-full mt-1" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    {loading ? <p role="status">Loading your resumes…</p> : error ? <p role="alert">{error} <button onClick={() => reload()} className="underline">Retry</button></p> : !matches.length ? <p className="brutal-card p-6">{data?.length ? 'No resumes match your search.' : 'Upload your first resume or build one from your career profile.'}</p> : <ul className="space-y-3">{matches.map((resume) => <li key={resume._id} className="brutal-card p-5 flex flex-wrap justify-between gap-4"><div><Link href={'/resume/' + resume._id} className="font-bold text-blue-700 underline">{resume.title}</Link><p className="text-sm mt-1">{resume.processingStatus === 'COMPLETED' ? resume.verifiedAt ? 'Verified and editable' : 'Ready to verify' : resume.processingStatus.toLowerCase()}</p></div>{resume.processingStatus === 'COMPLETED' && <Link href={'/resume/' + resume._id + '/edit'} className="underline text-sm">Edit facts</Link>}</li>)}</ul>}
  </div></AppShell></ProtectedRoute>;
}
