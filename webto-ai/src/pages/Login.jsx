import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Mail, Lock, ArrowRight, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Dynamic transparency calculation based on user typing
  const isTyping = email.length > 0 || password.length > 0;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('https://webtoai-backend.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid email or password.');
      }

      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      console.warn('Backend login fallback:', err.message);
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    setError('');
    setOauthLoading(true);

    try {
      if (provider === 'google') {
        const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (googleClientId) {
          const redirectUri = `${window.location.origin}/login`;
          const scope = 'openid email profile';
          window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}`;
          return;
        }
      } else if (provider === 'github') {
        const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
        if (githubClientId) {
          const redirectUri = `${window.location.origin}/login`;
          window.location.href = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
          return;
        }
      }

      const userPromptEmail = prompt(`Enter your ${provider === 'google' ? 'Google' : 'GitHub'} email to continue:`);
      if (!userPromptEmail) {
        setOauthLoading(false);
        return;
      }

      const res = await fetch('https://webtoai-backend.onrender.com/api/auth/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userPromptEmail.trim(),
          name: userPromptEmail.split('@')[0],
          provider: provider.toUpperCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to authenticate with ${provider}`);
      }

      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] bg-radial-gradient flex flex-col justify-center items-center p-4 font-sans text-slate-100 relative overflow-hidden">
      {/* Background Ambient Glows for enhanced glass transparency reflection */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Main Container - Transitions to deep transparent glass when typing */}
      <div 
        className={`w-full max-w-[420px] border rounded-3xl p-8 shadow-2xl relative overflow-hidden transition-all duration-500 ease-out ${
          isTyping
            ? 'bg-[#0c1222]/25 border-blue-500/30 backdrop-blur-2xl shadow-blue-950/20'
            : 'bg-[#0c1222]/60 border-slate-800/80 backdrop-blur-xl'
        }`}
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3.5 shadow-lg shadow-blue-500/10">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Welcome back</h1>
          <p className="text-xs text-slate-400 mt-1">Sign in to your WEBTO AI account</p>
        </div>

        {/* OAuth Buttons */}
        <div className="flex flex-col gap-2.5 mb-5">
          <button
            type="button"
            disabled={oauthLoading}
            onClick={() => handleOAuthLogin('google')}
            className={`w-full flex items-center justify-center gap-2.5 py-2.5 px-4 border rounded-xl text-xs font-semibold text-white transition-all duration-300 active:scale-[0.98] cursor-pointer ${
              isTyping 
                ? 'bg-slate-900/30 hover:bg-slate-800/50 border-slate-700/40 backdrop-blur-sm' 
                : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-700/60'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2c0 2.8.7 5.5 1.9 7.9l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            disabled={oauthLoading}
            onClick={() => handleOAuthLogin('github')}
            className={`w-full flex items-center justify-center gap-2.5 py-2.5 px-4 border rounded-xl text-xs font-semibold text-white transition-all duration-300 active:scale-[0.98] cursor-pointer ${
              isTyping 
                ? 'bg-slate-900/30 hover:bg-slate-800/50 border-slate-700/40 backdrop-blur-sm' 
                : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-700/60'
            }`}
          >
            <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>Continue with GitHub</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center mb-5">
          <div className="border-t border-slate-800/80 w-full"></div>
          <span className={`px-3 text-[10px] uppercase tracking-wider text-slate-500 absolute font-semibold transition-colors duration-300 ${
            isTyping ? 'bg-[#0c1222]/30 backdrop-blur-sm' : 'bg-[#0c1222]'
          }`}>
            Or continue with email
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-400 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2 text-xs text-green-400 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              EMAIL ADDRESS
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-all duration-300 ${
                  email.length > 0
                    ? 'bg-slate-950/20 border-blue-500/40 backdrop-blur-md focus:border-blue-400'
                    : 'bg-slate-950/60 border-slate-800/90 focus:border-blue-500'
                }`}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                PASSWORD
              </label>
              <a
                href="https://accounts.google.com/signin/recovery"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-blue-400 hover:text-blue-300 transition hover:underline cursor-pointer"
              >
                Forgot?
              </a>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className={`w-full pl-10 pr-10 py-2.5 border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-all duration-300 ${
                  password.length > 0
                    ? 'bg-slate-950/20 border-blue-500/40 backdrop-blur-md focus:border-blue-400'
                    : 'bg-slate-950/60 border-slate-800/90 focus:border-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <Link to="/signup" className="text-blue-400 hover:underline font-semibold cursor-pointer">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
