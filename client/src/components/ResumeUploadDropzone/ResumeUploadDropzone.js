import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { subscribeToJob } from '../../services/socket';

export default function ResumeUploadDropzone({ onUploadSuccess, onTimelineEvent }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const selected = acceptedFiles[0];
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, ''));
      }
      setError(null);
    }
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a resume file first');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title || file.name);

    try {
      const res = await api.post('/resumes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        },
      });

      const { resume, jobId } = res.data.data;

      // Subscribe to real-time agent updates for this job
      if (jobId && onTimelineEvent) {
        const unsubscribe = subscribeToJob(jobId, (event) => {
          onTimelineEvent(event);
        });

        // Auto clean subscription after 30s
        setTimeout(() => unsubscribe(), 30000);
      }

      if (onUploadSuccess) {
        onUploadSuccess(resume, jobId);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="brutal-card p-6">
      <h3 className="font-headline font-black text-xl uppercase tracking-tight text-[#1a1a1a] mb-2">
        Upload Resume Artifact
      </h3>
      <p className="text-xs text-gray-600 font-medium mb-6">
        Upload PDF, DOCX, or TXT. Our Agentic Pipeline will parse structured sections and compute baseline ATS metrics automatically.
      </p>

      {error && (
        <div className="p-3 mb-4 border-2 border-[#1a1a1a] bg-[#ffdad6] text-[#93000a] text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
            Resume Label / Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Primary SDE Resume 2026"
            className="brutal-input w-full text-xs"
          />
        </div>

        <div
          {...getRootProps()}
          className={`border-3 border-dashed border-[#1a1a1a] p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? 'bg-[#ffcc00]/20 border-solid' : 'bg-white hover:bg-[#faf7f2]'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 bg-[#1a1a1a] text-[#ffcc00] border-2 border-[#1a1a1a] flex items-center justify-center shadow-brutal">
              <UploadCloud className="w-6 h-6" />
            </div>
            {file ? (
              <div className="text-center">
                <p className="font-headline font-bold text-sm text-[#1a1a1a] flex items-center justify-center gap-1">
                  <FileText className="w-4 h-4 text-[#0055ff]" />
                  {file.name}
                </p>
                <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB — Click or drag to change
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="font-headline font-bold text-sm text-[#1a1a1a]">
                  Drag & drop resume file here, or <span className="text-[#0055ff] underline">browse files</span>
                </p>
                <p className="text-[11px] text-gray-500 font-medium mt-1 uppercase">
                  PDF, DOCX, TXT (Max 10MB)
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={!file || isUploading}
          className="brutal-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#ffcc00]" />
              <span>Processing with Parser Agent...</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4" />
              <span>Start Agentic Parsing Pipeline</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
