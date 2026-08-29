import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';

export default function ApplicationModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
}) {
  const [formData, setFormData] = useState({
    company: '',
    roleTitle: '',
    sourcePlatform: 'LinkedIn',
    jobLink: '',
    status: 'saved',
    salaryRange: '',
    location: '',
    notes: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        company: initialData.company || '',
        roleTitle: initialData.roleTitle || '',
        sourcePlatform: initialData.sourcePlatform || 'LinkedIn',
        jobLink: initialData.jobLink || '',
        status: initialData.status || 'saved',
        salaryRange: initialData.salaryRange || '',
        location: initialData.location || '',
        notes: initialData.notes || '',
      });
    } else {
      setFormData({
        company: '',
        roleTitle: '',
        sourcePlatform: 'LinkedIn',
        jobLink: '',
        status: 'saved',
        salaryRange: '',
        location: '',
        notes: '',
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.company.trim() || !formData.roleTitle.trim()) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-lg bg-[#f5f0e8] border-4 border-[#1a1a1a] shadow-brutal-xl animate-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b-3 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-between">
          <h3 className="font-headline font-black text-lg text-[#1a1a1a] uppercase">
            {initialData ? 'Update Tracked Application' : 'Add New Application'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 border-2 border-[#1a1a1a] bg-white hover:bg-[#e63b2e] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="e.g. Google, Stripe"
                className="brutal-input w-full text-xs"
              />
            </div>

            <div>
              <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                Role Title *
              </label>
              <input
                type="text"
                required
                value={formData.roleTitle}
                onChange={(e) => setFormData({ ...formData, roleTitle: e.target.value })}
                placeholder="e.g. Senior Backend Engineer"
                className="brutal-input w-full text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                Source Platform
              </label>
              <select
                value={formData.sourcePlatform}
                onChange={(e) => setFormData({ ...formData, sourcePlatform: e.target.value })}
                className="brutal-input w-full text-xs font-bold"
              >
                <option value="LinkedIn">LinkedIn</option>
                <option value="Internshala">Internshala</option>
                <option value="Naukri">Naukri</option>
                <option value="Indeed">Indeed</option>
                <option value="Company Portal">Company Portal</option>
                <option value="Referral">Referral</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                Pipeline Stage
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="brutal-input w-full text-xs font-bold"
              >
                <option value="saved">Saved / Bookmarked</option>
                <option value="applied">Applied</option>
                <option value="oa">Online Assessment (OA)</option>
                <option value="interview">Interview In-Progress</option>
                <option value="offer">Offer Received 🎉</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                Job Posting Link
              </label>
              <input
                type="url"
                value={formData.jobLink}
                onChange={(e) => setFormData({ ...formData, jobLink: e.target.value })}
                placeholder="https://..."
                className="brutal-input w-full text-xs"
              />
            </div>

            <div>
              <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                Location / Comp
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Remote / $140k"
                className="brutal-input w-full text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
              Personal Notes / Interview Timeline
            </label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Referral contact, recruiter notes, interview dates..."
              className="brutal-input w-full text-xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t-2 border-[#1a1a1a]">
            {initialData && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(initialData._id)}
                className="brutal-btn-red px-3 py-2 text-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border-2 border-[#1a1a1a] bg-white font-headline font-bold text-xs uppercase hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="brutal-btn-primary px-5 py-2 text-xs flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Application</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
