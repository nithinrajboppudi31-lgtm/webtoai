import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Shield, Save, CheckCircle, AlertCircle, Share2, Copy, Check, ExternalLink, Globe } from 'lucide-react';

export default function Settings() {
  const { user, token, updateUser } = useAuth();

  // Profile Form State
  const [displayName, setDisplayName] = useState(user?.name || 'User');
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [copied, setCopied] = useState(false);

  // Dynamic share profile URL
  const profileShareUrl = `${window.location.origin}/explore?creator=${encodeURIComponent(user?.email || '')}`;

  // Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });

    try {
      const res = await fetch('https://webtoai-backend.onrender.com/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: displayName }),
      });

      if (res.ok) {
        if (updateUser) updateUser({ name: displayName });
        setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
      } else {
        const data = await res.json();
        setProfileMsg({ type: 'error', text: data.error || 'Failed to update profile.' });
      }
    } catch {
      if (updateUser) updateUser({ name: displayName });
      setProfileMsg({ type: 'success', text: 'Profile name saved locally!' });
    }
  };

  const handleCopyProfileLink = () => {
    navigator.clipboard.writeText(profileShareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Quota calculation
  const totalBuilds = user?.freeBuildsTotal ?? 3;
  const usedBuilds = user?.freeBuildsUsed ?? 0;
  const buildsRemaining = user?.credits ?? Math.max(0, totalBuilds - usedBuilds);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 text-slate-100 font-sans">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
          <Shield className="w-6 h-6 text-blue-400" /> Account Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage your public profile details and share your workspace portfolio.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Profile Card */}
        <div className="bg-[#0e1626]/80 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-blue-500/20 mb-4">
            {displayName ? displayName[0].toUpperCase() : 'U'}
          </div>
          <h2 className="text-base font-bold text-white">{displayName || 'User'}</h2>
          <p className="text-xs text-slate-400 mb-3">{user?.email || 'user@example.com'}</p>
          <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded-full border border-blue-500/20 uppercase tracking-wider">
            {user?.role || 'USER'}
          </span>

          <div className="w-full mt-6 pt-6 border-t border-slate-800/80 space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Builds Remaining</span>
              <span className="font-bold text-emerald-400">{buildsRemaining}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Total Quota</span>
              <span className="font-bold text-slate-200">{totalBuilds}</span>
            </div>
          </div>
        </div>

        {/* Profile Details Form */}
        <div className="md:col-span-2 bg-[#0e1626]/80 border border-slate-800 rounded-3xl p-6">
          <h3 className="text-sm font-bold text-white mb-1">Profile Details</h3>
          <p className="text-xs text-slate-400 mb-4">Update your public display name.</p>

          {profileMsg.text && (
            <div
              className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-xs ${
                profileMsg.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}
            >
              {profileMsg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  disabled
                  value={user?.email || 'user@webto.ai'}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/50 border border-slate-800/60 rounded-xl text-xs text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Display Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 transition"
                  placeholder="Enter name"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/20 transition cursor-pointer"
            >
              <Save className="w-4 h-4" /> Save Profile
            </button>
          </form>
        </div>
      </div>

      {/* Share Profile & Portfolio Section */}
      <div className="bg-[#0e1626]/80 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Share Your Profile & Portfolio</h3>
            <p className="text-xs text-slate-400">
              Share your WEBTO AI creator link to showcase your web applications and deployments.
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:flex-1 flex items-center gap-2 overflow-hidden">
            <Share2 className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="text"
              readOnly
              value={profileShareUrl}
              className="bg-transparent text-xs text-blue-400 border-none outline-none truncate w-full font-mono"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyProfileLink}
              className="flex-1 sm:flex-initial px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <a
              href={profileShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition"
            >
              <span>View</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}