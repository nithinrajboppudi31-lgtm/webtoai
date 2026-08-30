import React from 'react';
import { 
  AppWindow, 
  Layers, 
  LayoutDashboard, 
  Store, 
  School, 
  Briefcase 
} from 'lucide-react';

const types = [
  {
    title: 'Web Applications',
    desc: 'Build modern web applications',
    icon: AppWindow,
    bg: 'bg-indigo-50 text-indigo-600',
  },
  {
    title: 'Full-Stack Applications',
    desc: 'End-to-end applications',
    icon: Layers,
    bg: 'bg-brand-50 text-brand-600',
  },
  {
    title: 'Dashboards',
    desc: 'Analytics and admin dashboards',
    icon: LayoutDashboard,
    bg: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'E-Commerce',
    desc: 'Online stores and marketplaces',
    icon: Store,
    bg: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: 'Student Management',
    desc: 'Management systems for institutions',
    icon: School,
    bg: 'bg-violet-50 text-violet-600',
  },
  {
    title: 'Portfolio Websites',
    desc: 'Personal and business portfolio sites',
    icon: Briefcase,
    bg: 'bg-fuchsia-50 text-fuchsia-600',
  },
];

export default function ProjectTypes({ onSelectType }) {
  return (
    <div className="w-full">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
        Popular Project Types
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {types.map((t, idx) => {
          const Icon = t.icon;
          return (
            <button
              key={idx}
              onClick={() => onSelectType(`Create a complete ${t.title} with modern UI, responsive design and backend functionality.`)}
              className="p-3.5 bg-white border border-gray-100 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-brand-200 transition-all text-left flex flex-col group"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 ${t.bg}`}>
                <Icon className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-gray-800 group-hover:text-brand-600 leading-tight mb-1">
                {t.title}
              </h4>
              <p className="text-[11px] text-gray-400 leading-tight">
                {t.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}