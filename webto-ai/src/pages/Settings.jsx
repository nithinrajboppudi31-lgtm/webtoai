import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Shield, Key, Eye, EyeOff, Save, CheckCircle, AlertCircle } from 'lucide-react';

export default function Settings() {
  // Added updateUser to sync state globally across the dashboard
  const { user, token, updateUser } = useAuth();

  // Profile Form State
  const [displayName, setDisplayName] = useState(user?.name || 'Nithinraj');
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  // Password Visibility Toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
        if (updateUser) updateUser({ name: displayName }); // Instantly update header/sidebar
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

  // Update Password
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    try {
      const res = await fetch('https://webtoai-backend.onrender.com/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword: currentPassword.trim(), newPassword: newPassword.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMsg({ type: 'error', text: data.error || 'Failed to change password.' });
      }
    } catch {
      setPasswordMsg({ type: 'error', text: 'Failed to connect to backend server.' });
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 text-slate-100 font-sans">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
          <Shield className="w-6 h-6 text-blue-400" /> Account Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage your profile details, security credentials, and API access keys.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Card */}
        <div className="bg-[#0e1626]/80 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-blue-500/20 mb-4">
            {displayName ? displayName[0].toUpperCase() : 'N'}
          </div>
          <h2 className="text-base font-bold text-white">{displayName || 'User'}</h2>
          <p className="text-xs text-slate-400 mb-3">{user?.email || 'user@example.com'}</p>
          <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded-full border border-blue-500/20">
            {user?.role || 'USER'}
          </span>

          <div className="w-full mt-6 pt-6 border-t border-slate-800/80 space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Builds Remaining</span>
              <span className="font-bold text-green-400">{user?.credits ?? 98}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Total Quota</span>
              <span className="font-bold text-slate-200">100</span>
            </div>
          </div>
        </div>

        {/* Profile Form */}
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
              {profileMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
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
                  value={user?.email || 'nithinrajboppudi31@gmail.com'}
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

      {/* Security & Password Section */}
      <div className="bg-[#0e1626]/80 border border-slate-800 rounded-3xl p-6">
        <h3 className="text-sm font-bold text-white mb-1">Security & Password</h3>
        <p className="text-xs text-slate-400 mb-4">Update your account password.</p>

        {passwordMsg.text && (
          <div
            className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-xs ${
              passwordMsg.type === 'success'
                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            {passwordMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{passwordMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Current Password (or 8-Character Reset Code)</label>
            <div className="relative max-w-md">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pr-10 pl-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition cursor-pointer"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-700 transition cursor-pointer"
          >
            <Key className="w-4 h-4" /> Update Password
          </button>
        </form>
      </div>
    </div>
  );
}