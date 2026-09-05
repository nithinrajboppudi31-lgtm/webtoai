import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Explore from './pages/Explore';

// Layout & Navigation Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MobileNav from './components/MobileNav';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Pages
import Home from './pages/Home';
import Workspace from './pages/Workspace';
import Projects from './pages/Projects';
import Templates from './pages/Templates';
import History from './pages/History';
import Deployments from './pages/Deployments';
import Credits from './pages/Credits';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Signup from './pages/Signup';

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

const API_BASE = 'https://webtoai-backend.onrender.com';

// Standalone Deployed Preview Component (No sidebar, no header, full screen sandbox)
function StandalonePreview() {
  const { id } = useParams();
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/public/preview/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load preview');

        const indexFile = data.project?.files?.find((f) => f.name === 'index.html');
        setHtml(indexFile?.content || data.project?.entryHtml || '');
      } catch (err) {
        console.error('Preview error:', err);
        setError(err.message || 'Deployed site not available.');
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
  }, [id]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#070b14] flex flex-col items-center justify-center text-slate-300">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-mono">Loading deployed application...</p>
      </div>
    );
  }

  if (error || !html) {
    return (
      <div className="h-screen w-screen bg-[#070b14] flex flex-col items-center justify-center text-slate-300">
        <p className="text-sm font-medium text-red-400 mb-2">{error || 'No entry point found for this project.'}</p>
        <a href="/" className="text-xs text-blue-400 underline">Return to WEBTO AI</a>
      </div>
    );
  }

  return (
    <iframe
      title="Deployed Preview"
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin allow-modals allow-forms"
      className="w-screen h-screen border-0 bg-white"
    />
  );
}

function AppContent() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';
  const isPreviewPage = location.pathname.startsWith('/preview/');

  // Standalone public preview route: no sidebar, no header
  if (isPreviewPage) {
    return (
      <Routes>
        <Route path="/preview/:id" element={<StandalonePreview />} />
      </Routes>
    );
  }

  if (isAuthPage) {
    return (
      <div className="min-h-screen w-screen bg-[#070b14] text-slate-100 font-sans">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-[#070b14] text-slate-100 font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#070b14]">
        <Header />

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/workspace" element={<Workspace />} />
            <Route path="/workspace/:id" element={<Workspace />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/history" element={<History />} />
            <Route path="/deployments" element={<Deployments />} />
            <Route path="/credits" element={<Credits />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <MobileNav />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
