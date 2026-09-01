import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, FolderKanban, History, User, PlusCircle } from 'lucide-react';

export default function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0f1d]/95 backdrop-blur-md border-t border-slate-800/80 px-6 py-2 flex justify-between items-center z-40 shadow-2xl select-none">
      <NavLink
        to="/"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 transition ${
            isActive ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`
        }
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-medium">Home</span>
      </NavLink>

      <NavLink
        to="/projects"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 transition ${
            isActive ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`
        }
      >
        <FolderKanban className="w-5 h-5" />
        <span className="text-[10px] font-medium">Projects</span>
      </NavLink>

      {/* Floating Center Create Action */}
      <NavLink to="/workspace" className="flex flex-col items-center -mt-6">
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 border-2 border-[#0a0f1d] active:scale-95 transition-transform">
          <PlusCircle className="w-6 h-6" />
        </div>
      </NavLink>

      <NavLink
        to="/history"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 transition ${
            isActive ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`
        }
      >
        <History className="w-5 h-5" />
        <span className="text-[10px] font-medium">History</span>
      </NavLink>

      <NavLink
        to="/settings"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 transition ${
            isActive ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`
        }
      >
        <User className="w-5 h-5" />
        <span className="text-[10px] font-medium">Profile</span>
      </NavLink>
    </nav>
  );
}
