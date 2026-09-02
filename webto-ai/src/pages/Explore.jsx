import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Compass, Eye, Copy, ExternalLink, Globe, Search, User, Sparkles } from 'lucide-react';

const API_BASE = 'https://webtoai-backend.onrender.com';

export default function Explore() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewProject, setPreviewProject] = useState(null);
  const [cloningId, setCloningId] = useState(null);

  useEffect(() => {
    loadPublicProjects();
  }, []);

  const loadPublicProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/explore/public`);
      const data = await res.json();
      if (res.ok && data.projects) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error('Failed to load explore projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloneProject = async (proj) => {
    setCloningId(proj.id);
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: `${proj.name} (Remix)`,
          description: proj.description || 'Remixed from Community Explore',
          type: proj.type || 'WEB_APP',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clone project');

      navigate(`/workspace/${data.project.id}`);
    } catch (err) {
      alert(`Clone error: ${err.message}`);
    } finally {
      setCloningId(null);
    }
  };

  const filteredProjects = projects.filter((p) =>
    (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.user?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Compass className="w-6 h-6 text-emerald-400" />
            Community Explore
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Discover creator profiles, live app photos, and community architectures built on WEBTO AI.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search apps or creators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0c1222] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-500 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
          <p className="text-xs">Loading community showcase...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-[#0c1222] border border-slate-800/80 rounded-3xl p-12 text-center max-w-md mx-auto">
          <Globe className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">No Public Projects Found</h3>
          <p className="text-xs text-slate-400 mb-4">
            Toggle your project visibility to <strong>Public</strong> in the Workspace to showcase your creations here.
          </p>
          <button
            onClick={() => navigate('/workspace')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition"
          >
            Go to Workspace
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((proj) => {
            const authorName = proj.user?.name || 'WEBTO Creator';
            const authorInitial = authorName.charAt(0).toUpperCase();

            return (
              <div
                key={proj.id}
                className="bg-[#0c1222] border border-slate-800/80 hover:border-emerald-500/40 rounded-3xl p-5 flex flex-col justify-between transition-all duration-200 group hover:shadow-xl hover:shadow-emerald-950/20"
              >
                <div>
                  {/* Creator Profile Header */}
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-white font-bold text-xs flex items-center justify-center shadow-md shadow-emerald-600/20 border border-emerald-400/30">
                        {authorInitial}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-200 leading-none">
                          {authorName}
                        </span>
                        <span className="text-[10px] text-slate-500 leading-tight mt-0.5">
                          Verified Creator
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                      {proj.type || 'WEB_APP'}
                    </span>
                  </div>

                  {/* Visual Project Thumbnail / Photo Preview */}
                  <div className="relative w-full h-36 rounded-2xl bg-slate-950/80 border border-slate-800/90 overflow-hidden mb-3.5 flex items-center justify-center group-hover:border-emerald-500/30 transition">
                    {proj.thumbnailUrl ? (
                      <img 
                        src={proj.thumbnailUrl} 
                        alt={proj.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#0a101d] to-[#060a12] p-4 text-center">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1.5 shadow-inner">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 truncate max-w-full">
                          {proj.name}
                        </span>
                        <span className="text-[9px] text-slate-600 uppercase tracking-widest mt-0.5">
                          Live Sandbox Snapshot
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Project Title & Description */}
                  <h3 className="text-base font-bold text-white mb-1.5 group-hover:text-emerald-400 transition-colors truncate">
                    {proj.name}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-5">
                    {proj.description || 'Interactive web application generated with WEBTO AI engine.'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                  <button
                    onClick={() => setPreviewProject(proj)}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700/60 transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>Preview</span>
                  </button>

                  <button
                    onClick={() => handleCloneProject(proj)}
                    disabled={cloningId === proj.id}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{cloningId === proj.id ? 'Cloning...' : 'Remix'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Preview Modal */}
      {previewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0c1222] border border-slate-800 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#070b14]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                  {(previewProject.user?.name || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{previewProject.name}</h3>
                  <p className="text-[11px] text-slate-400">Created by {previewProject.user?.name || 'Creator'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previewProject.deployedUrl && (
                  <a
                    href={previewProject.deployedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800 transition"
                    title="Open Live Deployment"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => setPreviewProject(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 bg-white">
              <iframe
                title="Community Live Canvas"
                srcDoc={previewProject.entryHtml || '<h3>No preview available</h3>'}
                className="w-full h-full border-none"
                sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
