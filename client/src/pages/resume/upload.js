import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../../components/AppShell/AppShell';
import ResumeUploadDropzone from '../../components/ResumeUploadDropzone/ResumeUploadDropzone';
import ProcessingTimeline from '../../components/ProcessingTimeline/ProcessingTimeline';
import { ArrowRight, CheckCircle2, Award, Sparkles, FileText, User } from 'lucide-react';

export default function ResumeUploadPage() {
  const router = useRouter();
  const [uploadedResume, setUploadedResume] = useState(null);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUploadSuccess = (resume, jobId) => {
    setIsProcessing(true);
    setUploadedResume(resume);
  };

  const handleTimelineEvent = (event) => {
    setTimelineEvents((prev) => [...prev, event]);
    if (event.step === 'ats_evaluation_completed' || event.step === 'parse_completed') {
      setIsProcessing(false);
    }
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-8 max-w-5xl mx-auto">
          {/* Header */}
          <div className="pb-4 border-b-3 border-[#1a1a1a] flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Step 1 of Pipeline
              </span>
              <h1 className="font-headline font-black text-3xl uppercase tracking-tight text-[#1a1a1a]">
                Upload & Parse Resume
              </h1>
              <p className="text-xs text-gray-600 font-medium mt-0.5">
                Drop your PDF or DOCX file to execute the Parser and Analyzer agent sequence.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="px-3 py-1.5 border-2 border-[#1a1a1a] bg-white font-headline font-bold text-xs uppercase hover:bg-gray-100"
            >
              Back to Console
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Dropzone Form */}
            <div className="lg:col-span-6 space-y-6">
              <ResumeUploadDropzone
                onUploadSuccess={handleUploadSuccess}
                onTimelineEvent={handleTimelineEvent}
              />
            </div>

            {/* Right Column: Live Timeline */}
            <div className="lg:col-span-6 space-y-6">
              <ProcessingTimeline
                events={timelineEvents}
                isRunning={isProcessing}
                title="Parser Agent Live Stream"
              />

              {uploadedResume && (
                <div className="p-4 border-3 border-[#1a1a1a] bg-[#ffcc00] shadow-brutal flex items-center justify-between">
                  <div>
                    <h4 className="font-headline font-black text-sm uppercase text-[#1a1a1a]">
                      Resume Uploaded Successfully!
                    </h4>
                    <p className="text-[11px] font-bold text-gray-800">
                      Ready for role tailoring, ATS breakdown, or gap analysis.
                    </p>
                  </div>
                  <Link
                    href={`/resume/${uploadedResume._id}`}
                    className="brutal-btn-primary px-4 py-2 text-xs flex items-center gap-1.5"
                  >
                    <span>View Detail</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
