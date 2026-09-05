import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FolderKanban, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Code2, 
  ExternalLink,
  Calendar,
  Layers,
  X,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Projects() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectType, setNewProjectType] = useState('FULL_STACK');
  const [creating, setCreating] = useState(false);

  // Edit / Rename State
  const [editingProject, setEditingProject] = useState(null);
  const [editName, setEditName] = useState('');

  // Custom Branded Delete Modal State
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const authToken = token || localStorage.getItem('token');
      const res = await fetch(`https://webtoai-backend.onrender.com/api/projects`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Smooth instant client-side search filtering (avoids search bar freezing)
  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const query = search.toLowerCase().trim();
    return projects.filter(
      (p) =>
        p.name?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.type?.toLowerCase().includes(query)
    );
  }, [projects, search]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setCreating(true);
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch('https://webtoai-backend.onrender.com/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDesc,
          type: newProjectType
        })
      });

      if (res.ok) {
        const data = await res.json();
        setIsModalOpen(false);
        setNewProjectName('');
        setNewProjectDesc('');
        // Navigate directly to the new project workspace
        navigate(`/workspace/${data.project.id}`);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Create Project Error: ${errData.error || 'Failed to create project'}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Create Project Error: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (!editName.trim() || !editingProject) return;

    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch(`https://webtoai-backend.onrender.com/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ name: editName })
      });

      if (res.ok) {
        setEditingProject(null);
        fetchProjects();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;

    setDeleting(true);
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch(`https://webtoai-backend.onrender.com/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
        setProjectToDelete(null);
      } else {
        alert(`Delete failed: ${data.error || 'Could not delete project from server.'}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Delete Error: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <FolderKanban className="w-6 h-6 text-blue-500" />
            Projects
          </h1>
          <p className="text-xs text-slate-400 mt-1">Manage and access all your generated applications</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white text-xs font-semibold shadow-md shadow-blue-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="w-full text-xs pl-10 pr-9 py-2.5 bg-[#0d1526] border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 shadow-sm transition-colors text-white placeholder-slate-400"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-3 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-[#0d1526] rounded-3xl border border-slate-800 p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-3 border border-blue-500/20">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">
            {search ? 'No matching projects found' : 'No projects found'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            {search ? 'Try searching with a different keyword.' : 'Create a new project to start generating web applications.'}
          </p>
          {!search && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Project</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/workspace/${project.id}`)}
              className="bg-[#0d1526] rounded-2xl border border-slate-800 p-5 shadow-lg hover:border-blue-500/50 transition-all flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-950/80 text-blue-400 border border-blue-800/40">
                    {project.type?.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProject(project);
                        setEditName(project.name);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800"
                      title="Rename"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(project);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-blue-400 transition-colors">
                  {project.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {project.description || 'No description provided.'}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1 font-semibold text-blue-400 group-hover:translate-x-0.5 transition-transform">
                  Open Workspace
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Dark Modal (Visible High-Contrast Text) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1626] rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
              <h3 className="text-base font-bold text-white">Create New Project</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g., SaaS Pricing Calculator"
                  className="w-full text-xs px-3.5 py-2.5 bg-[#141e30] border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Brief summary of your project..."
                  className="w-full text-xs px-3.5 py-2.5 bg-[#141e30] border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 resize-none text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Project Type</label>
                <select
                  value={newProjectType}
                  onChange={(e) => setNewProjectType(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-[#141e30] border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-white"
                >
                  <option value="FULL_STACK" className="bg-[#0e1626] text-white">Full-Stack Application</option>
                  <option value="WEB_APP" className="bg-[#0e1626] text-white">Web App</option>
                  <option value="DASHBOARD" className="bg-[#0e1626] text-white">Admin Dashboard</option>
                  <option value="ECOMMERCE" className="bg-[#0e1626] text-white">E-Commerce</option>
                  <option value="PORTFOLIO" className="bg-[#0e1626] text-white">Portfolio</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create & Open'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Dark Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1626] rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-800">
            <h3 className="text-base font-bold text-white mb-3">Rename Project</h3>
            <form onSubmit={handleUpdateName} className="space-y-4">
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-[#141e30] border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-white placeholder-slate-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic WEBTO AI Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e1626] border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center relative overflow-hidden">
            <button
              onClick={() => setProjectToDelete(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white mb-1.5">Delete Project</h3>
            <p className="text-xs text-slate-400 mb-2 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-white">"{projectToDelete.name}"</span>?
            </p>
            <p className="text-[11px] text-rose-400/90 mb-6 bg-rose-500/10 py-1.5 px-3 rounded-xl border border-rose-500/20">
              This action is permanent and cannot be undone.
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteProject}
                disabled={deleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/25 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Project
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
