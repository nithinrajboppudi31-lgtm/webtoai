import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function History() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/projects', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok && data.projects?.length > 0) {
        setProjects(data.projects);
        selectProject(data.projects[0]);
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
    }
  };

  const selectProject = async (proj) => {
    setSelectedProject(proj);
    setLoadingVersions(true);
    setPreviewHtml('');
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/projects/${proj.id}/versions`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok && data.versions) {
        setVersions(data.versions);
        if (data.versions.length > 0) {
          setPreviewHtml(data.versions[0].entryHtml);
        }
      }
    } catch (err) {
      console.error('Fetch history error:', err);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRollback = async (versionId) => {
    if (!window.confirm('Restore this version? The project codebase will be restored to this snapshot.')) return;

    setRollingBack(true);
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/projects/${selectedProject.id}/rollback/${versionId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rollback failed');

      navigate(`/workspace/${selectedProject.id}`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* 1. Projects Sidebar */}
      <div className="w-64 bg-slate-900/40 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Projects</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {projects.length === 0 ? (
            <div className="p-4 text-xs text-slate-500 text-center">No projects found</div>
          ) : (
            projects.map((proj) => (
              <button
                key={proj.id}
                onClick={() => selectProject(proj)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition ${
                  selectedProject?.id === proj.id
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <span className="truncate">{proj.name}</span>
                <i className="fa-solid fa-chevron-right text-[10px] opacity-60"></i>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 2. Version Timeline */}
      <div className="w-80 bg-slate-900/20 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white">Version Timeline</h2>
          <p className="text-[11px] text-slate-400">{versions.length} checkpoints recorded</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {loadingVersions ? (
            <div className="p-6 text-center text-xs text-slate-500">Loading versions...</div>
          ) : versions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No checkpoints recorded yet. Generate app features in the workspace to save checkpoints.
            </div>
          ) : (
            versions.map((ver, idx) => (
              <div
                key={ver.id}
                onClick={() => setPreviewHtml(ver.entryHtml)}
                className="p-3.5 bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-xl cursor-pointer transition text-xs space-y-2"
              >
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span className="font-semibold text-blue-400">v{versions.length - idx}.0</span>
                  <span>{new Date(ver.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-slate-200 line-clamp-2 italic">"{ver.prompt}"</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRollback(ver.id);
                  }}
                  disabled={rollingBack}
                  className="w-full py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 rounded-lg text-[11px] font-medium transition flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-rotate-left"></i>
                  Restore This Version
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. Snapshot Sandbox Preview */}
      <div className="flex-1 flex flex-col bg-slate-950">
        <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between text-xs text-slate-400">
          <span>Snapshot Sandbox Preview</span>
          {selectedProject && (
            <button
              onClick={() => navigate(`/workspace/${selectedProject.id}`)}
              className="text-blue-400 hover:underline flex items-center gap-1"
            >
              Open in Workspace <i className="fa-solid fa-arrow-right text-[10px]"></i>
            </button>
          )}
        </div>
        <div className="flex-1 bg-white">
          {previewHtml ? (
            <iframe
              title="History Snapshot Preview"
              srcDoc={previewHtml}
              className="w-full h-full border-none"
              sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-slate-950 text-slate-500 text-xs">
              Select a version checkpoint to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}