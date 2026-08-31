import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Sun, Moon, LogOut, Settings as SettingsIcon, AlertTriangle } from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Calculate live user builds balance
  const totalBuilds = user?.freeBuildsTotal ?? 3;
  const usedBuilds = user?.freeBuildsUsed ?? 0;
  const creditsRemaining = user?.credits ?? Math.max(0, totalBuilds - usedBuilds);

  // Theme toggle state
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    logout();
    navigate('/login');
  };

  return (
    <>
      <header className="h-14 border-b border-slate-800/80 bg-[#070b14]/90 backdrop-blur-md px-6 flex items-center justify-between z-30">
        {/* Left / Title */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="hover:text-slate-200 cursor-pointer" onClick={() => navigate('/workspace')}>
            Workspace
          </span>
          <span>/</span>
          <span className="text-white font-medium">Dashboard</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Builds Badge */}
          <div
            onClick={() => navigate('/credits')}
            className="px-3 py-1 bg-blue-950/60 border border-blue-500/30 rounded-full text-blue-400 text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-blue-900/40 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{creditsRemaining} Free Builds Left</span>
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition flex items-center justify-center"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-blue-400" />
            )}
          </button>

          {/* Profile Circle & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center hover:ring-2 hover:ring-blue-400 transition"
            >
              {user?.name ? user.name[0].toUpperCase() : 'N'}
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-48 bg-[#0e1626] border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 text-xs text-slate-300 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setDropdownOpen(false)}
              >
                <div className="px-4 py-2 border-b border-slate-800">
                  <p className="font-semibold text-white truncate">{user?.name || 'User'}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user?.email || 'user@webto.ai'}</p>
                </div>

                <button
                  onClick={() => navigate('/settings')}
                  className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-slate-800/80 text-left transition"
                >
                  <SettingsIcon className="w-4 h-4 text-slate-400" />
                  <span>Settings</span>
                </button>

                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-red-500/10 text-red-400 text-left transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0e1626] border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white mb-1">Confirm Logout</h3>
            <p className="text-xs text-slate-400 mb-6">
              Are you sure you want to sign out of your WEBTO AI account?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-600/20 transition"
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}