import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Templates() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [cloningId, setCloningId] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/templates');
      const data = await res.json();
      if (res.ok && data.templates) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error('Fetch templates error:', err);
    }
  };

  const handleUseTemplate = async (templateId) => {
    setCloningId(templateId);
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/templates/${templateId}/use`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clone template');

      const targetId = data.projectId || data.project?.id;
      // Navigate to the specific workspace with the project data in state
      navigate(`/workspace/${targetId}`, {
        state: {
          projectId: targetId,
          templateId: templateId,
          project: data.project,
        },
      });
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setCloningId(null);
    }
  };

  const filtered =
    selectedCategory === 'ALL'
      ? templates
      : templates.filter((t) => t.category.toUpperCase() === selectedCategory);

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-6xl w-full mx-auto space-y-8 bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <i className="fa-solid fa-shapes text-indigo-400"></i>
            Starter Template Library
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Pick a pre-configured architecture and customize it instantly using AI prompts.
          </p>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl self-start sm:self-auto text-xs">
          {['ALL', 'LANDING PAGE', 'DASHBOARD', 'PORTFOLIO'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg transition font-medium ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {cat === 'ALL' ? 'All Starters' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg transition"
          >
            <div className="h-44 bg-slate-950 border-b border-slate-800 relative overflow-hidden group">
              <iframe
                title={item.name}
                srcDoc={item.entryHtml}
                className="w-full h-full pointer-events-none transform scale-75 origin-top-left"
                style={{ width: '133%', height: '133%' }}
              />
              <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                <button
                  onClick={() => setPreviewTemplate(item)}
                  className="px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg font-semibold hover:bg-slate-700"
                >
                  <i className="fa-regular fa-eye mr-1"></i> Preview
                </button>
              </div>
            </div>

            <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {item.category}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">{item.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{item.description}</p>
              </div>

              <button
                onClick={() => handleUseTemplate(item.id)}
                disabled={cloningId === item.id}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow disabled:opacity-50"
              >
                {cloningId === item.id ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i>
                    Setting Up Workspace...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus"></i>
                    Use This Template
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Full Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[650px] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white">{previewTemplate.name}</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    handleUseTemplate(previewTemplate.id);
                    setPreviewTemplate(null);
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
                >
                  Clone into Workspace
                </button>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
            </div>
            <div className="flex-1 bg-white">
              <iframe
                title="Preview"
                srcDoc={previewTemplate.entryHtml}
                className="w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}