import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Layout, 
  ShoppingBag, 
  Utensils, 
  BarChart3, 
  Sparkles, 
  ArrowRight, 
  Smartphone, 
  Globe 
} from 'lucide-react';

const API_BASE = 'https://webtoai-backend.onrender.com';

const TEMPLATES = [
  {
    id: 'food-delivery',
    title: 'Food Delivery Marketplace',
    category: 'E-Commerce',
    badge: 'Popular',
    icon: Utensils,
    description: 'Swiggy/Zomato style food discovery platform with category pills, live cart drawer, and order simulation.',
    prompt: 'Create a modern food delivery web app like Swiggy with search bar, restaurant cards, menu items, interactive cart slider, and mock order tracking.',
    tags: ['Tailwind', 'Interactive Cart', 'Modals']
  },
  {
    id: 'saas-landing',
    title: 'Modern AI SaaS Landing Page',
    category: 'Landing Pages',
    badge: 'Trending',
    icon: Sparkles,
    description: 'High-conversion dark theme landing page with glassmorphism, feature grids, pricing tiers, and interactive FAQ.',
    prompt: 'Build a premium dark-themed SaaS landing page with hero banner, Bento grid feature showcase, interactive pricing switcher (monthly/annual), and testimonial carousel.',
    tags: ['Dark Mode', 'Bento Grid', 'Pricing']
  },
  {
    id: 'fintech-dashboard',
    title: 'FinTech Analytics & Crypto Hub',
    category: 'Dashboards',
    badge: 'Pro',
    icon: BarChart3,
    description: 'Executive financial dashboard with revenue charts, transaction tables, wallet balances, and transfer modals.',
    prompt: 'Build a comprehensive FinTech dashboard featuring account balance cards, live asset allocation chart, recent transaction history table, and quick send money modal.',
    tags: ['Analytics', 'Charts', 'Data Tables']
  },
  {
    id: 'ecommerce-store',
    title: 'Minimalist Fashion Storefront',
    category: 'E-Commerce',
    badge: 'New',
    icon: ShoppingBag,
    description: 'Clean clothing & apparel storefront with product filters, quick view modals, size pickers, and checkout drawer.',
    prompt: 'Generate an elegant minimalist ecommerce storefront for a luxury fashion brand with product grid, hover effects, size selectors, cart count badge, and checkout summary.',
    tags: ['Storefront', 'Filter Pills', 'Checkout']
  },
  {
    id: 'portfolio-creator',
    title: 'Developer / Creator Portfolio',
    category: 'Portfolio',
    badge: 'Simple',
    icon: Globe,
    description: 'Interactive resume and showcase site with dynamic project popups, tech stack badges, and a contact form.',
    prompt: 'Create a sleek developer portfolio site featuring an about section, interactive timeline, project gallery with modal previews, skill tags, and working contact form.',
    tags: ['Portfolio', 'Responsive', 'Forms']
  },
  {
    id: 'mobile-app-ui',
    title: 'Fitness & Habit Tracker App',
    category: 'Mobile UI',
    badge: 'Featured',
    icon: Smartphone,
    description: 'Mobile-first progressive web app interface for logging daily workouts, streaks, and calorie goals.',
    prompt: 'Design a mobile-first workout and calorie tracker UI with streak calendar, daily progress rings, activity cards, and modal workout logger.',
    tags: ['Mobile First', 'Progress Rings', 'Interactive']
  }
];

export default function Templates() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [creatingId, setCreatingId] = useState(null);

  const categories = ['All', 'E-Commerce', 'Landing Pages', 'Dashboards', 'Portfolio', 'Mobile UI'];

  const filteredTemplates = selectedCategory === 'All' 
    ? TEMPLATES 
    : TEMPLATES.filter(t => t.category === selectedCategory);

  const handleUseTemplate = async (template) => {
    setCreatingId(template.id);
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: template.title,
          description: template.description,
          type: 'WEB_APP',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create project');

      // Navigate to workspace and pass template prompt directly
      navigate(`/workspace/${data.project.id}`, {
        state: { initialPrompt: template.prompt }
      });
    } catch (err) {
      alert(`Template Error: ${err.message}`);
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Layout className="w-6 h-6 text-blue-400" />
          Starter Templates
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Jumpstart your full-stack application with pre-configured architectures and optimized prompts.
        </p>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition shrink-0 ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTemplates.map((template) => {
          const Icon = template.icon;
          const isCreating = creatingId === template.id;

          return (
            <div
              key={template.id}
              className="bg-[#0c1222] border border-slate-800/80 hover:border-blue-500/40 rounded-3xl p-5 flex flex-col justify-between transition-all duration-200 group hover:shadow-xl hover:shadow-blue-950/20"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                    {template.badge}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-1.5 group-hover:text-blue-400 transition-colors">
                  {template.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 mb-4">
                  {template.description}
                </p>

                <div className="flex flex-wrap gap-1.5 mb-6">
                  {template.tags.map((tag, i) => (
                    <span key={i} className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded-md border border-slate-800/60">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleUseTemplate(template)}
                disabled={isCreating}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {isCreating ? (
                  <span>Initializing Workspace...</span>
                ) : (
                  <>
                    <span>Use Template</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
