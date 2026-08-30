import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  FolderKanban, 
  LayoutTemplate,
  Compass,
  History, 
  Rocket, 
  Coins, 
  Settings, 
  Sparkles 
} from 'lucide-react';

const navItems = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Projects', path: '/projects', icon: FolderKanban },
  { name: 'Templates', path: '/templates', icon: LayoutTemplate },
  { name: 'Explore', path: '/explore', icon: Compass },
  { name: 'History', path: '/history', icon: History },
  { name: 'Deployments', path: '/deployments', icon: Rocket },
  { name: 'Credits', path: '/credits', icon: Coins },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-[#0F1117] text-gray-300 flex flex-col justify-between border-r border-gray-800 select-none">
      <div>
        {/* Brand Logo */}
        <div className="h-16 px-6 flex items-center gap-2.5 border-b border-gray-800">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-white text-base tracking-tight">WEBTO AI</span>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white font-semibold shadow-md shadow-brand-500/20'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-[#181B26]'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Upgrade Banner */}
      <div className="p-4 border-t border-gray-800/80">
        <div className="p-3.5 rounded-2xl bg-gradient-to-b from-gray-900 to-[#141824] border border-gray-800 text-center">
          <p className="text-xs font-bold text-white">Need unlimited builds?</p>
          <p className="text-[10px] text-gray-400 mt-1">Upgrade to Pro for full AI autonomy.</p>
          <NavLink
            to="/credits"
            className="mt-3 block w-full py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-sm"
          >
            Upgrade Plan
          </NavLink>
        </div>
      </div>
    </aside>
  );
}