import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Sparkles, 
  ArrowRight, 
  Code2, 
  Globe, 
  Layers, 
  LayoutDashboard, 
  ShoppingBag,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const promptTemplates = [
  {
    title: 'SaaS Landing Page',
    type: 'WEB_APP',
    icon: Globe,
    badge: 'Popular',
    prompt: 'A modern SaaS landing page for an AI productivity tool with hero section, pricing calculator, feature cards, and contact form.'
  },
  {
    title: 'E-Commerce Storefront',
    type: 'ECOMMERCE',
    icon: ShoppingBag,
    badge: 'Trending',
    prompt: 'An interactive e-commerce product catalog with category filters, cart sidebar, interactive quantity buttons, and checkout summary.'
  },
  {
    title: 'Analytics Dashboard',
    type: 'DASHBOARD',
    icon: LayoutDashboard,
    badge: 'Pro',
    prompt: 'A sleek revenue admin dashboard with statistical metric cards, transaction history table, and interactive widgets.'
  },
  {
    title: 'Portfolio Website',
    type: 'PORTFOLIO',
    icon: Code2,
    badge: 'Essential',
    prompt: 'A clean developer portfolio showcase with animated project cards, skills grid, resume download button, and contact modal.'
  }
];

export default function Home() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [selectedType, setSelectedType] = useState('FULL_STACK');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStartBuilding = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || loading) return;

    setError('');
    setLoading(true);

    const authToken = token || localStorage.getItem('token');
    
    if (!authToken) {
      navigate('/login');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: prompt.trim().slice(0, 32) + (prompt.length > 32 ? '...' : ''),
          description: prompt.trim(),
          type: selectedType
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned ${res.status}: Failed to create project`);
      }

      const data = await res.json();
      
      // Navigate to Workspace passing initial prompt
      navigate(`/workspace/${data.project.id}`, { 
        state: { initialPrompt: prompt.trim() } 
      });
    } catch (err) {
      console.error('Project creation failed:', err);
      setError(
        err.message.includes('fetch') 
          ? 'Cannot connect to backend server at http://localhost:5000. Please ensure the server terminal is running.'
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (template) => {
    setPrompt(template.prompt);
    setSelectedType(template.type);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-10">
      {/* Hero Section */}
      <div className="text-center space-y-3.5 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-brand-600" />
          <span>Powered by Webto-Ai</span>
        </div>

        {/* Full solid blue text */}
        <h1 className="text-3xl md:text-5xl font-black text-blue-500 tracking-tight leading-tight">
          Turn your ideas into production apps in seconds
        </h1>

        <p className="text-xs md:text-sm text-gray-500 leading-relaxed">
          Describe what you want to build. WEBTO AI generates the code, architecture, and live preview automatically.
        </p>
      </div>

      {/* Main Prompt Generator Card */}
      <div className="bg-white rounded-3xl p-5 md:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 space-y-4">
        <form onSubmit={handleStartBuilding} className="space-y-4">
          <div className="relative">
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Build an interactive fitness dashboard that tracks daily calories, workouts, water intake, and weekly progress charts..."
              className="w-full text-xs md:text-sm p-4 bg-gray-50/80 border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all resize-none text-gray-800 placeholder:text-gray-400"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-100 px-4 py-3 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 font-medium">Type:</span>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:border-brand-500"
              >
                <option value="FULL_STACK">Full-Stack Application</option>
                <option value="WEB_APP">Web App</option>
                <option value="DASHBOARD">Dashboard</option>
                <option value="ECOMMERCE">E-Commerce</option>
                <option value="PORTFOLIO">Portfolio</option>
              </select>

              <span className="text-xs text-gray-400 hidden sm:inline">|</span>

              <span className="text-xs text-gray-400">
                Free Builds: <strong className="text-gray-800">{(user?.freeBuildsTotal || 3) - (user?.freeBuildsUsed || 0)}</strong>
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:opacity-95 text-white text-xs font-bold shadow-md shadow-brand-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{loading ? 'Initializing Project...' : 'Start Building'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Starter Templates */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Suggested Starters
          </h2>
          <span className="text-[11px] text-gray-400">Click any card to load prompt</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {promptTemplates.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <div
                key={tpl.title}
                onClick={() => selectTemplate(tpl)}
                className="text-left p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:border-brand-300 hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                      {tpl.badge}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-gray-900 group-hover:text-brand-600 transition-colors">
                    {tpl.title}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">
                    {tpl.prompt}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-gray-50 flex items-center justify-between text-[11px] font-semibold text-brand-600">
                  <span>Use Template</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}