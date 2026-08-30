import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  ArrowRight,
  Plus,
  FolderKanban,
  LayoutTemplate,
  Compass,
  Rocket,
  Search,
  Code2,
  Terminal,
  Database,
  Globe,
  ExternalLink,
  Zap
} from 'lucide-react';

const REPLIT_STARTERS = [
  {
    id: 'fullstack-app',
    title: 'Full-Stack Web App',
    desc: 'React, Node API & Live Preview',
    icon: Globe,
    color: 'from-blue-600 to-cyan-500',
    prompt: 'Build a full-stack dashboard with real-time analytics and responsive UI'
  },
  {
    id: 'saas-landing',
    title: 'SaaS Landing Page',
    desc: 'Hero, pricing cards, testimonials',
    icon: Zap,
    color: 'from-purple-600 to-pink-500',
    prompt: 'Build a modern SaaS landing page with dark theme, pricing calculator, and animations'
  },
  {
    id: 'fintech-crypto',
    title: 'Fintech / Crypto Hub',
    desc: 'Trading charts, wallet balances',
    icon: Database,
    color: 'from-emerald-600 to-teal-500',
    prompt: 'Build a fintech portal with transactions log, currency charts, and card checkout'
  },
  {
    id: 'dev-portfolio',
    title: 'Developer Portfolio',
    desc: 'Project showcases & contact forms',
    icon: Terminal,
    color: 'from-amber-500 to-orange-600',
    prompt: 'Build a developer portfolio with interactive project cards, skills list, and contact modal'
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [promptText, setPromptText] = useState('');
  const [recentProjects, setRecentProjects] = useState([]);
  const [publicShowcase, setPublicShowcase] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    const authToken = token || localStorage.getItem('token');
    
    // 1. Fetch user recent projects if logged in
    if (authToken) {
      try {
        const res = await fetch('https://webtoai-backend.onrender.com/api/projects', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (res.ok && data.projects) {
          setRecentProjects(data.projects.slice(0, 4));
        }
      } catch (err) {
        console.error('Error loading projects:', err);
      }
    }

    // 2. Fetch Explore showcase
    try {
      const exploreRes = await fetch('https://webtoai-backend.onrender.com/api/explore');
      const exploreData = await exploreRes.json();
      if (exploreRes.ok && exploreData.projects) {
        setPublicShowcase(exploreData.projects.slice(0, 3));
      }
    } catch (err) {
      console.error('Error loading showcase:', err);
    }
  };

  const handleLaunchPrompt = (customPrompt) => {
    const text = customPrompt || promptText;
    if (!text.trim()) return;

    if (user) {
      navigate('/projects', { state: { initialPrompt: text.trim() } });
    } else {
      navigate('/login', { state: { initialPrompt: text.trim() } });
    }
  };

  return (
    <div className="min-h-screen bg-[#0E1117] text-slate-200 font-sans flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="h-14 border-b border-[#212634] bg-[#0E1117]/95 px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-white text-base tracking-tight">WEBTO AI</span>
        </div>

        {/* Global Search / Jump */}
        <div className="hidden md:flex items-center gap-2 bg-[#181C27] border border-[#262C3D] px-3 py-1.5 rounded-xl w-80 text-xs text-slate-400">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search templates, projects or prompts..."
            className="bg-transparent w-full focus:outline-none text-white placeholder-slate-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          {user ? (
            <>
              <button
                onClick={() => navigate('/projects')}
                className="px-3.5 py-1.5 bg-[#1F2433] hover:bg-[#282F42] text-slate-200 rounded-lg text-xs font-semibold border border-[#2B3347] transition flex items-center gap-1.5"
              >
                <FolderKanban className="w-3.5 h-3.5 text-blue-400" />
                <span>My Projects</span>
              </button>
              <div
                onClick={() => navigate('/settings')}
                className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-400 transition"
              >
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="px-3 py-1.5 text-slate-300 hover:text-white text-xs font-semibold transition"
              >
                Log In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow shadow-blue-600/20"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Replit Dashboard Feed */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-10 space-y-10">
        
        {/* Hero Prompt Bar (Replit style create repl input) */}
        <div className="bg-[#141824] border border-[#23293D] rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2">
              What do you want to build today?
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mb-6">
              Describe your web app idea. WEBTO AI will synthesize code, components, and live sandboxes instantly.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLaunchPrompt();
              }}
              className="flex items-center gap-2 bg-[#0A0D14] border border-[#2A3147] rounded-2xl p-2 focus-within:border-blue-500 transition shadow-inner"
            >
              <div className="pl-3 pr-1 text-blue-400">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <input
                type="text"
                placeholder="e.g. Build an AI food delivery dashboard with interactive checkout..."
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="flex-1 bg-transparent py-2 text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
              >
                <span>Create</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Quick Starter Templates */}
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-blue-400" />
              <span>Starter Templates</span>
            </h2>
            <button
              onClick={() => navigate('/templates')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
            >
              View all
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            {REPLIT_STARTERS.map((starter) => {
              const Icon = starter.icon;
              return (
                <div
                  key={starter.id}
                  onClick={() => handleLaunchPrompt(starter.prompt)}
                  className="bg-[#141824] hover:bg-[#1A2030] border border-[#23293D] hover:border-blue-500/50 rounded-2xl p-4 cursor-pointer transition flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${starter.color} flex items-center justify-center text-white shadow-md`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white group-hover:text-blue-400 transition">{starter.title}</h3>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{starter.desc}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#1F2538] flex items-center justify-between text-[10px] text-slate-400">
                    <span>Click to synthesize</span>
                    <Plus className="w-3.5 h-3.5 text-blue-400 group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Recent Workspaces / Projects (If logged in) */}
        {user && recentProjects.length > 0 && (
          <section className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-emerald-400" />
                <span>Your Recent Projects</span>
              </h2>
              <button
                onClick={() => navigate('/projects')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                See all projects ({recentProjects.length})
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              {recentProjects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => navigate(`/workspace/${proj.id}`)}
                  className="bg-[#141824] hover:bg-[#1A2030] border border-[#23293D] rounded-2xl p-4 cursor-pointer transition space-y-3 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                      {proj.type || 'WEB_APP'}
                    </span>
                    {proj.isDeployed && (
                      <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        Live
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition">{proj.name}</h3>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{proj.description || 'Custom Web Application'}</p>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <span>Open Workspace</span>
                    <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-1 transition" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Community Explore Showcase */}
        {publicShowcase.length > 0 && (
          <section className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-4 h-4 text-purple-400" />
                <span>Community Showcase</span>
              </h2>
              <button
                onClick={() => navigate('/explore')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                Explore Community
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {publicShowcase.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate('/explore')}
                  className="bg-[#141824] border border-[#23293D] rounded-2xl p-4 cursor-pointer hover:border-slate-700 transition space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white truncate">{item.name}</span>
                    <span className="text-[10px] text-slate-500">by {item.user?.name || 'Creator'}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{item.description || 'Public community project'}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Replit-style bottom bar */}
      <footer className="border-t border-[#212634] py-4 px-6 text-center text-xs text-slate-500 flex items-center justify-between max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>All AI engines operational</span>
        </div>
        <span>© 2026 WEBTO AI</span>
      </footer>
    </div>
  );
}