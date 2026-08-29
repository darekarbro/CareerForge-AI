import React, { useState } from 'react';
import { Plus, Building, ExternalLink, Edit3, ArrowRight } from 'lucide-react';
import ApplicationModal from './ApplicationModal';

const columns = [
  { id: 'saved', label: 'Saved', color: 'bg-gray-200 border-gray-400' },
  { id: 'applied', label: 'Applied', color: 'bg-[#ffcc00]/40 border-[#ffcc00]' },
  { id: 'oa', label: 'OA Assessment', color: 'bg-[#0055ff]/20 border-[#0055ff]' },
  { id: 'interview', label: 'Interviewing', color: 'bg-purple-200 border-purple-500' },
  { id: 'offer', label: 'Offer Received', color: 'bg-green-200 border-green-500' },
  { id: 'rejected', label: 'Archived', color: 'bg-red-100 border-red-300' },
];

export default function ApplicationBoard({
  applications = [],
  onAddApplication,
  onUpdateApplication,
  onDeleteApplication,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  const handleOpenAdd = () => {
    setSelectedApp(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (app) => {
    setSelectedApp(app);
    setModalOpen(true);
  };

  const handleSaveModal = (formData) => {
    if (selectedApp) {
      onUpdateApplication(selectedApp._id, formData);
    } else {
      onAddApplication(formData);
    }
    setModalOpen(false);
  };

  const handleDeleteModal = (appId) => {
    if (confirm('Are you sure you want to remove this application?')) {
      onDeleteApplication(appId);
      setModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-headline font-black text-2xl uppercase tracking-tight text-[#1a1a1a]">
            Application Pipeline
          </h2>
          <p className="text-xs text-gray-600 font-medium">
            Manage your opportunities across each interview and offer stage.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="brutal-btn-primary px-4 py-2.5 text-xs flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Application</span>
        </button>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colApps = applications.filter((a) => a.status === col.id);

          return (
            <div
              key={col.id}
              className="flex flex-col border-3 border-[#1a1a1a] bg-[#f5f0e8] min-w-[220px]"
            >
              {/* Column Header */}
              <div className={`p-3 border-b-3 border-[#1a1a1a] font-headline font-black text-xs uppercase flex items-center justify-between ${col.color}`}>
                <span>{col.label}</span>
                <span className="w-5 h-5 bg-[#1a1a1a] text-white rounded-full flex items-center justify-center text-[10px]">
                  {colApps.length}
                </span>
              </div>

              {/* Card List */}
              <div className="p-2 space-y-3 flex-1 min-h-[300px]">
                {colApps.length === 0 ? (
                  <div className="h-24 border-2 border-dashed border-gray-300 flex items-center justify-center text-[11px] text-gray-400 font-bold uppercase">
                    Empty
                  </div>
                ) : (
                  colApps.map((app) => (
                    <div
                      key={app._id}
                      onClick={() => handleOpenEdit(app)}
                      className="p-3 border-2 border-[#1a1a1a] bg-white shadow-brutal hover:shadow-brutal-lg cursor-pointer transition-all group"
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="font-headline font-black text-xs text-[#1a1a1a] truncate">
                          {app.company}
                        </span>
                        <Edit3 className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#0055ff]" />
                      </div>

                      <p className="text-[11px] font-bold text-gray-700 leading-tight mb-2">
                        {app.roleTitle}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-1 pt-2 border-t border-gray-100 text-[10px] text-gray-500 font-medium">
                        <span className="px-1.5 py-0.5 bg-[#f5f0e8] border border-[#1a1a1a] font-bold">
                          {app.sourcePlatform}
                        </span>
                        <span>{new Date(app.appliedDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ApplicationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveModal}
        onDelete={handleDeleteModal}
        initialData={selectedApp}
      />
    </div>
  );
}
