import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Rocket, 
  ExternalLink, 
  Copy, 
  Check, 
  Trash2, 
  Layers, 
  Globe, 
  RefreshCw, 
  Radio, 
  Plus 
} from 'lucide-react';

export default function Deployments() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchDeployments();
  }, []);

  const fetchDeployments = async () => {
    setLoading(true);
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch('https://webtoai-backend.onrender.com/api/deployments', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok && data.deployments) {
        setDeployments(data.deployments);
      }
    } catch (err) {
      console.error('Fetch deployments error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUndeploy = async (id) => {
    if (!window.confirm('Are you sure you want to unpublish this live website?')) return;

    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch(`https://webtoai-backend.onrender.com/api/deploy/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setDeployments((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error('Undeploy error:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-950 text-slate-100 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Rocket className="w-6 h-6 text-emerald-400" />
              Live Deployments
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Manage your hosted web applications, share live preview URLs, and monitor deployment health.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchDeployments}
              className="p-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition"
              title="Refresh Deployments"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => navigate('/projects')}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Deploy New Project
            </button>
          </div>
        </div>

        {/* Deployments List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-28 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse"></div>
            ))}
          </div>
        ) : deployments.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/20 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Globe className="w-7 h-7 text-slate-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">No active deployments</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Open any generated project in the workspace and click the <span className="text-emerald-400 font-semibold">Deploy</span> button on the top toolbar to publish it.
              </p>
            </div>
            <button
              onClick={() => navigate('/projects')}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg transition"
            >
              Go to Projects
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {deployments.map((item) => {
              const isVercel = item.deployedUrl?.includes('vercel.app');
              return (
                <div
                  key={item.id}
                  className="p-5 bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition shadow-sm"
                >
                  {/* Deployment Info */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <Radio className="w-3 h-3 animate-pulse" /> LIVE
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 border border-purple-500/20 text-purple-400">
                        {isVercel ? 'VERCEL EDGE' : 'STANDALONE RUNNER'}
                      </span>
                      <h3 className="text-base font-bold text-white truncate">{item.name}</h3>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span className="truncate max-w-md text-emerald-400 font-mono bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-800/40">
                        {item.deployedUrl}
                      </span>
                      <span>•</span>
                      <span>Updated {new Date(item.updatedAt || item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
                    <button
                      onClick={() => handleCopyLink(item.deployedUrl, item.id)}
                      className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition flex items-center gap-1.5"
                      title="Copy Public URL"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    <a
                      href={item.deployedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Visit Site
                    </a>

                    <button
                      onClick={() => navigate(`/workspace/${item.id}`)}
                      className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition flex items-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Workspace
                    </button>

                    <button
                      onClick={() => handleUndeploy(item.id)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"
                      title="Unpublish Site"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}