import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Topbar() {
  const { user, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-sync fresh credits from the backend when the user focuses the tab
  useEffect(() => {
    const handleFocus = () => {
      if (refreshUser) refreshUser();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshUser]);

  const buildsUsed = user?.freeBuildsUsed ?? 0;
  const buildsTotal = user?.freeBuildsTotal ?? 3;
  const buildsLeft = user?.credits ?? Math.max(0, buildsTotal - buildsUsed);

  const currentPathName = location.pathname.replace('/', '') || 'Home';

  return (
    <header className="h-16 px-3 sm:px-6 bg-white dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 backdrop-blur-md flex items-center justify-between transition-colors duration-200 shrink-0 select-none">
      {/* Breadcrumb path */}
      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate mr-2">
        <span className="hidden sm:inline">Workspace</span>
        <span className="hidden sm:inline">/</span>
        <span className="text-slate-900 dark:text-white font-medium capitalize truncate">
          {currentPathName}
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Credits Badge */}
        <button
          onClick={() => navigate('/credits')}
          className="px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 flex items-center gap-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer"
        >
          <i className="fa-solid fa-bolt text-[11px]"></i>
          <span>
            <span className="hidden xs:inline">{buildsLeft} Free Builds Left</span>
            <span className="xs:hidden">{buildsLeft} Builds</span>
          </span>
        </button>

        {/* Dark/Light Mode Switcher */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition shadow-sm cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <i className="fa-regular fa-sun text-sm text-amber-400"></i>
          ) : (
            <i className="fa-regular fa-moon text-sm text-slate-700"></i>
          )}
        </button>

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2 sm:gap-2.5 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center uppercase shadow-inner shrink-0">
            {user?.name?.[0] || user?.email?.[0] || 'U'}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-slate-900 dark:text-white leading-none">
              {user?.name || user?.email?.split('@')[0]}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight truncate max-w-[120px]">
              {user?.email}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
