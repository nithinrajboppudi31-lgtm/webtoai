import React, { useState } from 'react';
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
  Sparkles,
  Menu,
  X
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobileMenu = () => setMobileOpen(false);

  const navContent = (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand Logo */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-white text-base tracking-tight">WEBTO AI</span>
          </div>
          {/* Close button for mobile drawer */}
          <button
            type="button"
            onClick={closeMobileMenu}
            className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/20'
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
            onClick={closeMobileMenu}
            className="mt-3 block w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-sm"
          >
            Upgrade Plan
          </NavLink>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Navigation Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0F1117] border-b border-gray-800 sticky top-0 z-30 w-full select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">WEBTO AI</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800/80 border border-gray-800 transition"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Slide-Over Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={closeMobileMenu}
          />

          {/* Slide-Over Drawer */}
          <div className="relative w-64 max-w-[80vw] bg-[#0F1117] text-gray-300 border-r border-gray-800 shadow-2xl z-10 flex flex-col h-full animate-in slide-in-from-left duration-200">
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 bg-[#0F1117] text-gray-300 border-r border-gray-800 select-none h-full">
        {navContent}
      </aside>
    </>
  );
}
