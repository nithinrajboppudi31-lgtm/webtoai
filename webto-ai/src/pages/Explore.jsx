import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Compass, GitFork, Search, Sparkles, User } from 'lucide-react';

export default function Explore() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [forkingId, setForkingId] = useState(null);

  useEffect(() => {
    fetchCommunityProjects();
  }, []);

  const fetchCommunityProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://webtoai-backend.onrender.com/api/explore');
      const data = await res.json();
      if (res.ok && data.projects) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error('Explore fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleForkProject = async (projectId) => {
    const authToken = token || localStorage.getItem('token');
    if (!authToken) {
      navigate('/login');
      return;
    }

    setForkingId(projectId);
    try {
      const res = await fetch(`https://webtoai-backend.onrender.com/api/projects/${projectId}/fork`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fork project');

      navigate(`/workspace/${data.projectId}`);
    } catch (err) {
      alert(`Fork Error: ${err.message}`);
    } finally {
      setForkingId(null);
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-950 text-slate-100 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Compass className="w-6 h-6 text-blue-400" />
              Community Showcase
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Explore web apps crafted by creators and fork any codebase straight to your workspace.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search community creations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Gallery Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-72 rounded-3xl bg-slate-900/50 border border-slate-800 animate-pulse"></div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-16 text-center rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/20 space-y-3">
            <Sparkles className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-white">No public projects found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Be the first to publish a project to the showcase by toggling public visibility in your workspace!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-3xl overflow-hidden flex flex-col justify-between transition group shadow-lg"
              >
                {/* Live Preview Snapshot Box */}
                <div className="h-44 w-full bg-slate-950 relative overflow-hidden border-b border-slate-800">
                  {item.entryHtml ? (
                    <iframe
                      title={item.name}
                      srcDoc={item.entryHtml}
                      className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none border-none bg-white"
                      sandbox="allow-scripts"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-slate-600">
                      No visual preview
                    </div>
                  )}
                  <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent transition"></div>
                </div>

                {/* Card Meta & Actions */}
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">
                        {item.type || 'WEB_APP'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white truncate">{item.name}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {item.description || 'Full-stack responsive application generated with WEBTO AI.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-[10px]">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs text-slate-300 truncate">
                        {item.user?.name || 'Anonymous Creator'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleForkProject(item.id)}
                      disabled={forkingId === item.id}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow disabled:opacity-50"
                    >
                      <GitFork className="w-3.5 h-3.5" />
                      <span>{forkingId === item.id ? 'Forking...' : 'Fork App'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}