import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../../components/AppShell/AppShell';
import ResumeUploadDropzone from '../../components/ResumeUploadDropzone/ResumeUploadDropzone';
import ProcessingTimeline from '../../components/ProcessingTimeline/ProcessingTimeline';
import { watchProcessingJob } from '../../services/processing';
import api from '../../services/api';

export default function ResumeUploadPage() {
  const [resume, setResume] = useState(null), [jobId, setJobId] = useState(null);
  const [events, setEvents] = useState([]), [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const running = ['UPLOADING', 'PENDING', 'RUNNING', 'RETRYING', 'COMMITTING'].includes(status);
  useEffect(() => {
    if (!jobId) return;
    return watchProcessingJob(jobId, {
      onEvent: (event) => setEvents((previous) => [...previous, event]),
      onStatus: (job) => {
        setStatus(job.status);
        if (job.status === 'COMPLETED') { setResume(job.output.resume); setError(''); }
        else if (job.status === 'FAILED' || job.status === 'CANCELLED') setError(job.error?.message || 'Processing was ' + job.status.toLowerCase());
      },
      onError: (failure) => setError(failure.response?.data?.message || 'Connection interrupted; reconnecting to the saved job...'),
    });
  }, [jobId]);
  const cancel = async () => {
    try { await api.post('/processing-jobs/' + jobId + '/cancel'); setStatus('CANCELLED'); }
    catch (failure) { setError(failure.response?.data?.message || 'Unable to cancel this job'); }
  };
  return <ProtectedRoute><AppShell>
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="pb-4 border-b-3 border-[#1a1a1a] flex justify-between gap-4">
        <div><h1 className="font-headline font-black text-3xl uppercase">Upload & Parse Resume</h1>
          <p className="text-xs mt-2">Upload PDF, DOCX or TXT. Processing continues in the background.</p></div>
        <Link href="/dashboard" className="font-bold text-xs underline">Back to dashboard</Link>
      </div>
      {error && <p role="alert" className="p-3 border-2 border-red-800 bg-red-50 text-red-900 text-sm">{error}</p>}
      <div className="grid lg:grid-cols-2 gap-8">
        <ResumeUploadDropzone disabled={running}
          onUploadStart={() => { setEvents([]); setResume(null); setJobId(null); setError(''); setStatus('UPLOADING'); }}
          onUploadError={(message) => { setError(message); setStatus('FAILED'); }}
          onUploadSuccess={(uploaded, id) => { setResume(uploaded); setJobId(id); setStatus('PENDING'); }} />
        <div className="space-y-6">
          <ProcessingTimeline events={events} isRunning={running} title="Resume processing" />
          {running && <div className="brutal-card p-4 text-sm">
            <p role="status">Resume processing: {status.toLowerCase()}</p>
            {jobId && status !== 'COMMITTING' && <button type="button" onClick={cancel} className="underline font-bold mt-3">Cancel processing</button>}
          </div>}
          {resume && status === 'COMPLETED' && <div className="brutal-card p-4 bg-[#ffcc00] space-y-3">
            <p className="font-bold">Resume processing completed. Review the extracted facts before using them.</p>
            <Link href={'/resume/' + resume._id} className="brutal-btn-primary px-4 py-2 inline-block text-sm">View resume details</Link>
          </div>}
          {resume && ['FAILED', 'CANCELLED'].includes(status) && <Link href={'/resume/' + resume._id} className="underline text-sm">Inspect this upload or upload another file</Link>}
        </div>
      </div>
    </div>
  </AppShell></ProtectedRoute>;
}
