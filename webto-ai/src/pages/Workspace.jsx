import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const GithubIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

const API_BASE = 'https://webtoai-backend.onrender.com';

const GENERATION_STAGES = [
  { stage: '1/4', title: 'Parsing Architecture & Visual Hierarchy', log: 'Decoding prompt tokens and scanning visual structure...' },
  { stage: '2/4', title: 'Synthesizing Tailwind CSS & Layout Modules', log: 'Constructing responsive DOM hierarchy and theme components...' },
  { stage: '3/4', title: 'Compiling In-Memory State & Reactivity', log: 'Generating JavaScript state controllers and event listeners...' },
  { stage: '4/4', title: 'Assembling Files & Standalone Sandbox', log: 'Synthesizing index.html, styles, and live preview runtime...' },
];

export default function Workspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, setUser } = useAuth();

  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('preview');
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [entryHtml, setEntryHtml] = useState('');
  const [promptInput, setPromptInput] = useState(location.state?.initialPrompt || '');
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [liveLogs, setLiveLogs] = useState([]);
  const [deploying, setDeploying] = useState(false);
  const [copied, setCopied] = useState(false);

  // Bring Your Own Key (BYOK) State
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(localStorage.getItem('user_gemini_key') || '');

  // WEBTO AI Custom Branded Error Popup State
  const [errorModal, setErrorModal] = useState({ open: false, title: '', message: '' });

  // Mobile Bottom Drawer & Actions
  const [mobilePromptOpen, setMobilePromptOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Draggable Floating Pill State
  const [pillPos, setPillPos] = useState({ x: 0, y: 0 });
  const [isDraggingPill, setIsDraggingPill] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, initX: 0, initY: 0 });

  // Photo / Mockup Upload State
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Device Viewport State
  const [deviceViewport, setDeviceViewport] = useState('desktop');
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef(null);

  // GitHub Export State
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [githubTokenInput, setGithubTokenInput] = useState(localStorage.getItem('gh_token') || '');
  const [githubRepoName, setGithubRepoName] = useState('');
  const [githubPrivate, setGithubPrivate] = useState(false);
  const [pushingGithub, setPushingGithub] = useState(false);
  const [pushedRepoUrl, setPushedRepoUrl] = useState('');

  // Visibility & SEO State
  const [isPublicProject, setIsPublicProject] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);
  const [showSeoModal, setShowSeoModal] = useState(false);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoSlug, setSeoSlug] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [savingSeo, setSavingSeo] = useState(false);

  // Chat / Voice State
  const [isListening, setIsListening] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatChips, setChatChips] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (id && id !== 'undefined') {
      loadProject();
    }
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (project) {
      setIsPublicProject(!!project.isPublic);
      setSeoTitle(project.name || '');
      setSeoSlug(project.slug || project.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || '');
      setSeoDescription(project.description || '');
    }
  }, [project]);

  useEffect(() => {
    let progressInterval = null;
    let logInterval = null;

    if (generating) {
      setGenerateProgress(5);
      setCurrentStageIndex(0);
      setLiveLogs(['[INIT] Connecting to WEBTO AI synthesis engine...', '[SYS] Initializing LLM context & schema validation...']);

      progressInterval = setInterval(() => {
        setGenerateProgress((prev) => {
          if (prev >= 98) return 98;
          let inc = 1;
          if (prev < 30) inc = Math.floor(Math.random() * 4) + 2;
          else if (prev < 70) inc = Math.floor(Math.random() * 3) + 1;
          else if (prev < 90) inc = Math.floor(Math.random() * 2) + 1;
          else inc = 0.5;

          const nextVal = Math.min(prev + inc, 98);

          if (nextVal >= 25 && nextVal < 50) setCurrentStageIndex(1);
          else if (nextVal >= 50 && nextVal < 75) setCurrentStageIndex(2);
          else if (nextVal >= 75) setCurrentStageIndex(3);

          return parseFloat(nextVal.toFixed(1));
        });
      }, 250);

      logInterval = setInterval(() => {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        const possibleLogs = [
          `[${timestamp}] Synthesizing Tailwind responsive grid...`,
          `[${timestamp}] Rendering full-stack client components...`,
          `[${timestamp}] Injecting dynamic state handlers & events...`,
          `[${timestamp}] Parsing FontAwesome glyph icons and typography...`,
          `[${timestamp}] Compiling modular project files array...`,
          `[${timestamp}] Sanitizing execution sandbox & HTML5 entrypoint...`
        ];

        setLiveLogs((prevLogs) => {
          if (prevLogs.length >= 8) return [...prevLogs.slice(1), possibleLogs[Math.floor(Math.random() * possibleLogs.length)]];
          return [...prevLogs, possibleLogs[prevLogs.length % possibleLogs.length]];
        });
      }, 1200);
    } else {
      setGenerateProgress(0);
      setLiveLogs([]);
      setCurrentStageIndex(0);
    }

    return () => {
      if (progressInterval) clearInterval(progressInterval);
      if (logInterval) clearInterval(logInterval);
    };
  }, [generating]);

  const loadProject = async () => {
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/projects/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned invalid response format.');
      }
      const data = await res.json();
      if (res.ok && data.project) {
        setProject(data.project);
        setIsPublicProject(!!data.project.isPublic);
        setSeoTitle(data.project.name || '');
        setSeoSlug(data.project.slug || '');
        setSeoDescription(data.project.description || '');

        const indexFile = data.project.files?.find((f) => f.name === 'index.html');
        if (indexFile) {
          setEntryHtml(indexFile.content);
        } else if (data.project.entryHtml) {
          setEntryHtml(data.project.entryHtml);
        }

        if (data.project.files && data.project.files.length > 0) {
          setFiles(data.project.files);
          setSelectedFile(data.project.files[0]);
        }
      }
    } catch (err) {
      console.error('Error loading project:', err);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorModal({
        open: true,
        title: 'Unsupported File Format',
        message: 'Please upload a valid image file (PNG, JPG, WEBP, etc.) to use as a wireframe.'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result);
      setSelectedImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleToggleVisibility = async () => {
    setUpdatingVisibility(true);
    try {
      const nextState = !isPublicProject;
      const authToken = token || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/projects/${id}/visibility`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ isPublic: nextState }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update visibility');
      setIsPublicProject(data.isPublic);
    } catch (err) {
      setErrorModal({
        open: true,
        title: 'Visibility Setting Failed',
        message: err.message || 'Unable to update project visibility.'
      });
    } finally {
      setUpdatingVisibility(false);
    }
  };

  const handleSaveSeo = async (e) => {
    e.preventDefault();
    setSavingSeo(true);
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/projects/${id}/seo`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: seoTitle.trim(),
          slug: seoSlug.trim(),
          description: seoDescription.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update SEO');

      setProject(data.project);
      if (data.entryHtml) {
        setEntryHtml(data.entryHtml);
        setIframeKey((prev) => prev + 1);
      }
      setShowSeoModal(false);
    } catch (err) {
      setErrorModal({
        open: true,
        title: 'SEO Settings Error',
        message: err.message || 'Failed to update SEO settings.'
      });
    } finally {
      setSavingSeo(false);
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorModal({
        open: true,
        title: 'Voice Input Unsupported',
        message: 'Speech recognition is not supported in this browser. Please use Chrome or Edge.'
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setPromptInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const openRequirementChat = (currentProj) => {
    setShowChatModal(true);
    if (chatMessages.length === 0) {
      setChatMessages([
        {
          role: 'assistant',
          content: `Hi! Let's build or customize **${currentProj?.name || 'your project'}**. Tell me any features, colors, or page components you want!`,
        }
      ]);
      setChatChips(['Dark Modern Layout', 'Add Payment Flow', 'Add Cart & Checkout Drawer']);
    }
  };

  const handleSendChatMessage = async (customText) => {
    const textToSend = customText || chatInput;
    if (!textToSend.trim() || chatLoading) return;

    const updatedHistory = [...chatMessages, { role: 'user', content: textToSend }];
    setChatMessages(updatedHistory);
    setChatInput('');
    setChatLoading(true);

    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/chat/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ messages: updatedHistory })
      });

      const data = await res.json();
      if (res.ok) {
        setChatMessages([...updatedHistory, { role: 'assistant', content: data.message }]);
        setChatChips(data.chips || []);
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleApplyChatChanges = () => {
    setShowChatModal(false);
    const fullConversation = chatMessages
      .map((m) => `${m.role === 'user' ? 'User Requested' : 'Architect Plan'}: ${m.content}`)
      .join('\n');
    handleGenerate(`Apply all architectural changes and specifications from this discussion:\n${fullConversation}`);
  };

  const handleGenerate = async (promptToUse) => {
    const text = promptToUse || promptInput;
    if ((!text || !text.trim()) && !selectedImage) return;
    if (generating) return;

    // Check if user has active custom BYOK key
    const userCustomKey = localStorage.getItem('user_gemini_key') || null;

    // Only enforce platform credit limit if NOT using a custom API key
    if (!userCustomKey) {
      const totalAllowed = (user?.credits || 0) + (user?.freeBuildsTotal ?? 3);
      const used = user?.freeBuildsUsed ?? 0;
      const remaining = totalAllowed - used;

      if (user && totalAllowed > 0 && remaining <= 0) {
        setShowUpgradeModal(true);
        return;
      }
    }

    const authToken = token || localStorage.getItem('token');
    setGenerating(true);
    setMobilePromptOpen(false);

    try {
      // 1. If project ID is missing from URL, create project first
      let currentProjectId = id;
      if (!currentProjectId || currentProjectId === 'undefined') {
        const createRes = await fetch(`${API_BASE}/api/projects`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            name: text.slice(0, 30) || 'New Project',
            prompt: text,
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok || !createData.project?.id) {
          throw new Error(createData.error || 'Failed to initialize project session.');
        }
        currentProjectId = createData.project.id;
        setProject(createData.project);
        navigate(`/workspace/${currentProjectId}`, { replace: true });
      }

      // 2. Call generate with project ID + optional user custom key
      const res = await fetch(`${API_BASE}/api/generate/${currentProjectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          prompt: (text || 'Generate matching design based on attached image').trim(),
          image: selectedImage || null,
          customApiKey: userCustomKey
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403 && data.error?.toLowerCase().includes('quota')) {
          setShowUpgradeModal(true);
          return;
        }
        throw new Error(data.error || 'Failed to generate code');
      }

      setGenerateProgress(100);

      if (data.entryHtml) {
        setEntryHtml(data.entryHtml);
        setIframeKey((prev) => prev + 1);
      }
      if (data.files && data.files.length > 0) {
        setFiles(data.files);
        setSelectedFile(data.files[0]);
      }

      if (setUser && !userCustomKey) {
        setUser((prev) => ({
          ...prev,
          credits: data.remainingCredits !== undefined ? data.remainingCredits : prev?.credits,
          freeBuildsUsed: (prev?.freeBuildsUsed ?? 0) + 1
        }));
      }

      setPromptInput('');
      handleRemoveImage();
    } catch (err) {
      console.error('Generation Error:', err);
      setErrorModal({
        open: true,
        title: 'Synthesis Interrupted',
        message: 'The synthesis engine encountered a temporary timeout or token limit on this complex prompt. Tap "Try Again" to re-run synthesis with optimized parameters.'
      });
    } finally {
      setTimeout(() => {
        setGenerating(false);
      }, 500);
    }
  };

  const handleDeploy = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!entryHtml) {
      setErrorModal({
        open: true,
        title: 'Application Not Ready',
        message: 'Please generate your project code first before deploying to live production.'
      });
      return;
    }

    const authToken = token || localStorage.getItem('token');
    setDeploying(true);
    try {
      const res = await fetch(`${API_BASE}/api/deploy/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to deploy');

      setProject(data.project);

      const targetUrl = data.deployedUrl || `https://webtoai.vercel.app/preview/${id}`;
      const opened = window.open(targetUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        navigator.clipboard?.writeText(targetUrl);
        setErrorModal({
          open: true,
          title: '🚀 Application Live!',
          message: `Your app has been published successfully! The URL has been copied to your clipboard:\n${targetUrl}`
        });
      }
    } catch (err) {
      setErrorModal({
        open: true,
        title: 'Deployment Error',
        message: err.message || 'Deployment could not be finalized. Please retry in a few moments.'
      });
    } finally {
      setDeploying(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!entryHtml && (!files || files.length === 0)) {
      setErrorModal({
        open: true,
        title: 'Export Unavailable',
        message: 'No code is available to export. Generate an application first.'
      });
      return;
    }

    try {
      const zip = new JSZip();

      if (files && files.length > 0) {
        files.forEach((file) => {
          const cleanPath = file.path?.startsWith('/') ? file.path.slice(1) : file.name;
          zip.file(cleanPath, file.content || '');
        });
      } else if (entryHtml) {
        zip.file('index.html', entryHtml);
      }

      const packageJson = {
        name: (project?.name || 'webto-ai-project').toLowerCase().replace(/\s+/g, '-'),
        version: '1.0.0',
        private: true,
        scripts: { start: 'serve .' }
      };
      zip.file('package.json', JSON.stringify(packageJson, null, 2));

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `${project?.name || 'project'}-source.zip`);
    } catch (err) {
      console.error('Export error:', err);
      setErrorModal({
        open: true,
        title: 'Export Error',
        message: 'Failed to package project files into ZIP.'
      });
    }
  };

  const handlePushToGithub = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!githubTokenInput.trim() || !githubRepoName.trim()) {
      setErrorModal({
        open: true,
        title: 'GitHub Information Required',
        message: 'Please provide both your GitHub Personal Access Token and a repository name.'
      });
      return;
    }

    setPushingGithub(true);
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/github/push/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          githubToken: githubTokenInput.trim(),
          repoName: githubRepoName.trim(),
          isPrivate: githubPrivate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to export repository to GitHub.');

      setPushedRepoUrl(data.repoUrl);
      localStorage.setItem('gh_token', githubTokenInput.trim());
    } catch (err) {
      setErrorModal({
        open: true,
        title: 'GitHub Export Error',
        message: err.message || 'Failed to push repository to GitHub.'
      });
    } finally {
      setPushingGithub(false);
    }
  };

  const handleCopyCode = () => {
    const code = selectedFile ? selectedFile.content : entryHtml;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Draggable Touch & Mouse handlers for the floating toolbar
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    dragStartRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initX: pillPos.x,
      initY: pillPos.y,
    };
    setIsDraggingPill(true);
  };

  const handleTouchMove = (e) => {
    if (!isDraggingPill) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStartRef.current.startX;
    const deltaY = touch.clientY - dragStartRef.current.startY;
    setPillPos({
      x: dragStartRef.current.initX + deltaX,
      y: dragStartRef.current.initY + deltaY,
    });
  };

  const handleTouchEnd = () => {
    setIsDraggingPill(false);
  };

  return (
    <div className="flex flex-col h-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans relative select-none">
      {/* Top Navbar */}
      <header className="h-12 md:h-14 border-b border-slate-800/80 px-3 md:px-4 flex items-center justify-between bg-[#0b1324] shrink-0 z-20">
        <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0"
          >
            &larr; Back
          </button>
          <span className="text-xs md:text-sm font-semibold text-white tracking-wide truncate max-w-[110px] sm:max-w-[200px] md:max-w-none">
            {project?.name || 'Workspace Canvas'}
          </span>
          <span className="hidden sm:inline text-[10px] md:text-[11px] px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-400 border border-blue-800/40 shrink-0">
            {project?.type || 'FULL_STACK'}
          </span>
        </div>

        {/* Viewport Switcher & Primary Actions */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Viewports (Desktop, Tablet, Mobile) */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5 text-[11px] md:text-xs">
            <button
              onClick={() => setDeviceViewport('desktop')}
              className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded ${deviceViewport === 'desktop' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Desktop
            </button>
            <button
              onClick={() => setDeviceViewport('tablet')}
              className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded ${deviceViewport === 'tablet' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Tablet
            </button>
            <button
              onClick={() => setDeviceViewport('mobile')}
              className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded ${deviceViewport === 'mobile' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Mobile
            </button>
          </div>

          {/* BYOK / API Key Configuration */}
          <button
            onClick={() => setShowKeyModal(true)}
            className={`text-xs px-2 md:px-2.5 py-1 rounded border transition flex items-center gap-1.5 ${
              customApiKey
                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300 hover:bg-emerald-900/60'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Configure Custom Gemini Key"
          >
            <span>🔑</span>
            <span className="hidden sm:inline">{customApiKey ? 'Custom Key' : 'API Key'}</span>
          </button>

          {/* Large Screen Secondary Buttons */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={handleToggleVisibility}
              disabled={updatingVisibility}
              className={`text-xs px-2.5 py-1 rounded border transition ${
                isPublicProject
                  ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {updatingVisibility ? 'Updating...' : isPublicProject ? 'Public' : 'Private'}
            </button>

            <button
              onClick={() => setShowSeoModal(true)}
              className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              SEO / Slug
            </button>

            <button
              onClick={() => setShowGithubModal(true)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </button>

            <button
              onClick={handleDownloadZip}
              className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              Export ZIP
            </button>
          </div>

          {/* AI Chat */}
          <button
            onClick={() => openRequirementChat(project)}
            className="text-[11px] md:text-xs px-2 md:px-2.5 py-1 rounded bg-blue-900/60 hover:bg-blue-800/80 text-blue-300 border border-blue-700/50 transition whitespace-nowrap"
          >
            AI Chat
          </button>

          {/* Deploy Action */}
          <button
            type="button"
            onClick={(e) => handleDeploy(e)}
            disabled={deploying || !entryHtml}
            className="text-[11px] md:text-xs font-medium px-2.5 md:px-3.5 py-1 md:py-1.5 rounded bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm disabled:opacity-50 transition whitespace-nowrap"
          >
            {deploying ? 'Deploying...' : 'Deploy'}
          </button>
        </div>
      </header>

      {/* Main Workspace Canvas Split */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop & Tablet Sidebar (Prompt Studio) */}
        <aside className="hidden md:flex w-72 lg:w-80 border-r border-slate-800 bg-[#090f1d] flex-col p-4 shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Prompt Studio</span>
          </div>

          <div className="relative mb-2">
            <textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Describe pages, features, interactions, or state to build..."
              rows={5}
              className="w-full bg-[#0d1627] border border-slate-700 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`absolute bottom-2.5 right-2.5 p-1.5 rounded-full ${
                isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🎤
            </button>
          </div>

          {imagePreview && (
            <div className="relative mb-3 rounded-lg overflow-hidden border border-slate-700 max-h-32 bg-slate-900">
              <img src={imagePreview} alt="Mockup" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white rounded-full p-1 text-[10px]"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 mb-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-1.5 px-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded text-[11px] text-slate-300 transition text-center"
            >
              📷 Attach Wireframe
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={generating || (!promptInput.trim() && !selectedImage)}
            className="w-full py-2 px-4 rounded-lg font-medium text-xs bg-blue-600 hover:bg-blue-500 text-white shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'Synthesizing Application...' : 'Generate / Update Code'}
          </button>
        </aside>

        {/* Right Side: Tab Switcher & Sandbox Preview */}
        <main className="flex-1 flex flex-col bg-[#0b101d] overflow-hidden relative">
          {/* View Tabs */}
          <div className="h-9 md:h-10 border-b border-slate-800/90 px-3 md:px-4 flex items-center justify-between bg-[#080d19] shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`text-[11px] md:text-xs px-2.5 md:px-3 py-1 rounded font-medium transition ${
                  activeTab === 'preview' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                Live Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`text-[11px] md:text-xs px-2.5 md:px-3 py-1 rounded font-medium transition ${
                  activeTab === 'code' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                Code Editor ({files.length || (entryHtml ? 1 : 0)})
              </button>
            </div>

            {activeTab === 'code' && (
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-[11px] md:text-xs px-2 md:px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            )}
          </div>

          {/* Canvas Display */}
          <div className="flex-1 overflow-hidden relative flex justify-center items-center p-1 md:p-2 bg-[#050811]">
            {/* DYNAMIC REAL-TIME PROGRESS OVERLAY */}
            {generating && (
              <div className="absolute inset-0 z-30 bg-[#060b14]/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md bg-[#0e1627] border border-blue-900/60 rounded-2xl p-4 shadow-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-400 font-semibold tracking-wide">
                      Stage {GENERATION_STAGES[currentStageIndex]?.stage}: {GENERATION_STAGES[currentStageIndex]?.title}
                    </span>
                    <span className="text-slate-300 font-mono font-bold">{generateProgress}%</span>
                  </div>

                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${generateProgress}%` }}
                    />
                  </div>

                  {/* Backend Terminal Stream Lines */}
                  <div className="bg-black/60 rounded-xl p-3 text-[10px] md:text-xs font-mono text-emerald-400/90 space-y-1 max-h-36 overflow-y-auto border border-slate-800">
                    {liveLogs.map((log, i) => (
                      <div key={i} className="truncate animate-fade-in flex items-center gap-1.5">
                        <span className="text-blue-500">❯</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-center text-[11px] text-slate-400 animate-pulse">
                    Synthesizing application components and live sandbox...
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'preview' ? (
              <div
                className={`h-full transition-all duration-300 shadow-2xl rounded-lg overflow-hidden border border-slate-800 bg-white ${
                  deviceViewport === 'mobile'
                    ? 'w-[375px]'
                    : deviceViewport === 'tablet'
                    ? 'w-[768px]'
                    : 'w-full'
                }`}
              >
                {entryHtml ? (
                  <iframe
                    key={iframeKey}
                    ref={iframeRef}
                    title="Rendered App Preview"
                    srcDoc={entryHtml}
                    sandbox="allow-scripts allow-same-origin allow-modals allow-forms"
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d1527] text-slate-400 p-4 text-center">
                    <p className="text-xs md:text-sm">No preview generated yet.</p>
                    <p className="text-[11px] text-slate-500 mt-1">Tap the floating Prompt pill to generate your app.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col md:flex-row bg-[#0d1627] rounded-lg overflow-hidden border border-slate-800">
                <div className="w-full md:w-48 border-b md:border-b-0 md:border-r border-slate-800 bg-[#09101f] p-2 overflow-x-auto md:overflow-y-auto flex md:flex-col gap-1 shrink-0">
                  <div className="hidden md:block text-[11px] font-semibold text-slate-400 px-2 py-1 uppercase">Files</div>
                  {files.length > 0 ? (
                    files.map((f, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedFile(f)}
                        className={`text-left px-2 py-1 md:py-1.5 rounded text-xs whitespace-nowrap md:truncate transition ${
                          selectedFile?.name === f.name ? 'bg-blue-600/30 text-blue-400' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        📄 {f.name}
                      </button>
                    ))
                  ) : (
                    <button
                      type="button"
                      className="text-left px-2 py-1 rounded text-xs text-blue-400 bg-blue-600/20 truncate"
                    >
                      📄 index.html
                    </button>
                  )}
                </div>

                <div className="flex-1 p-3 md:p-4 overflow-auto">
                  <pre className="text-xs font-mono text-slate-200 leading-relaxed whitespace-pre">
                    {selectedFile ? selectedFile.content : entryHtml}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* DRAGGABLE FLOATING VERCEL-STYLE PILL */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translate(calc(-50% + ${pillPos.x}px), ${pillPos.y}px)`,
        }}
        className="md:hidden fixed bottom-6 left-1/2 z-40 flex items-center gap-1.5 bg-[#121826]/95 backdrop-blur-md border border-slate-700/80 rounded-full px-3 py-1.5 shadow-2xl cursor-move touch-none active:scale-95 transition-transform"
      >
        <button
          onClick={() => setMobilePromptOpen(true)}
          className="flex items-center gap-1.5 text-xs text-slate-200 font-medium px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-500 transition"
        >
          <span>✨</span>
          <span>Prompt</span>
        </button>

        <div className="w-[1px] h-4 bg-slate-700 mx-0.5" />

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-1.5 text-slate-300 hover:text-white rounded-full hover:bg-slate-800 transition"
          aria-label="Actions"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* MOBILE PROMPT BOTTOM DRAWER */}
      {mobilePromptOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-[#0b1324] border-t border-slate-700 rounded-t-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white tracking-wide">Generate / Update Code</span>
              <button
                onClick={() => setMobilePromptOpen(false)}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="relative">
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="What would you like to build or modify?"
                rows={4}
                className="w-full bg-[#060b14] border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
              <button
                type="button"
                onClick={handleVoiceInput}
                className={`absolute bottom-2.5 right-2.5 p-1.5 rounded-full ${
                  isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400'
                }`}
              >
                🎤
              </button>
            </div>

            {imagePreview && (
              <div className="relative rounded-lg overflow-hidden border border-slate-700 max-h-24 bg-slate-900">
                <img src={imagePreview} alt="Mockup" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 text-[10px]"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2 px-3 bg-slate-800 rounded-lg text-xs text-slate-300 shrink-0"
              >
                📷 Image
              </button>
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={generating || (!promptInput.trim() && !selectedImage)}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs disabled:opacity-50"
              >
                {generating ? 'Synthesizing...' : 'Run Generation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE ACTIONS BOTTOM MENU */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-[#0b1324] border-t border-slate-700 rounded-t-2xl p-4 shadow-2xl space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-white">Project Actions</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setShowKeyModal(true);
              }}
              className="w-full py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 font-medium text-left text-xs text-white flex items-center justify-between shadow"
            >
              <span>🔑 BYOK (Custom Gemini Key)</span>
              <span className={customApiKey ? 'text-emerald-400' : 'text-slate-400'}>
                {customApiKey ? 'Active' : 'Configure'}
              </span>
            </button>

            <button
              onClick={(e) => {
                setMobileMenuOpen(false);
                handleDeploy(e);
              }}
              disabled={deploying || !entryHtml}
              className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 font-medium text-left text-xs text-white flex items-center justify-between shadow"
            >
              <span>🚀 Deploy Application</span>
              <span>{deploying ? 'Deploying...' : 'Go Live'}</span>
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleToggleVisibility();
              }}
              className="w-full py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-left text-xs text-slate-200 flex items-center justify-between"
            >
              <span>Project Visibility</span>
              <span className={isPublicProject ? 'text-emerald-400' : 'text-slate-400'}>
                {isPublicProject ? 'Public' : 'Private'}
              </span>
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setShowSeoModal(true);
              }}
              className="w-full py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-left text-xs text-slate-200"
            >
              SEO & Vanity Slug
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setShowGithubModal(true);
              }}
              className="w-full py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-left text-xs text-slate-200 flex items-center gap-2"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span>Export to GitHub</span>
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleDownloadZip();
              }}
              className="w-full py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-left text-xs text-slate-200"
            >
              Download Source ZIP
            </button>
          </div>
        </div>
      )}

      {/* DYNAMIC CREDIT LIMIT / QUOTA OVER REMINDER MODAL */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#0e172a] border border-red-500/30 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto text-xl">
              ⚡
            </div>
            
            <div>
              <h3 className="text-base font-bold text-white mb-1">Free Builds Exhausted</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                You have utilized your free synthesis allowance ({user?.freeBuildsUsed ?? 0} / {(user?.freeBuildsTotal ?? 3) + (user?.credits || 0)} builds). Connect your own Gemini API Key for unlimited builds, or top up credits.
              </p>
            </div>

            <div className="bg-[#182338] border border-slate-700/60 rounded-xl p-3 flex justify-between items-center text-xs">
              <span className="text-slate-400">Remaining Builds:</span>
              <span className="text-blue-400 font-mono font-bold">
                {Math.max(0, ((user?.credits || 0) + (user?.freeBuildsTotal ?? 3)) - (user?.freeBuildsUsed ?? 0))} Builds
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowUpgradeModal(false);
                  setShowKeyModal(true);
                }}
                className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                Use Own Key
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUpgradeModal(false);
                  navigate('/credits');
                }}
                className="flex-1 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs shadow-md transition"
              >
                Refill Credits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPLIT-STYLE BRING YOUR OWN KEY (BYOK) MODAL */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#0e172a] border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🔑</span>
                <h3 className="text-sm font-semibold text-white">Bring Your Own Key (BYOK)</h3>
              </div>
              <button onClick={() => setShowKeyModal(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Use your own Google Gemini API key to get unlimited generations and zero queue times, just like Replit and Bolt.
            </p>

            <div>
              <label className="block text-xs text-slate-300 mb-1 font-medium">Gemini API Key</label>
              <input
                type="password"
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Keys are stored in your browser's encrypted local storage and sent securely with requests.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {customApiKey && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('user_gemini_key');
                    setCustomApiKey('');
                    setShowKeyModal(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-950/40 text-red-400 border border-red-800/40 text-xs hover:bg-red-900/40"
                >
                  Clear Key
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (customApiKey.trim()) {
                    localStorage.setItem('user_gemini_key', customApiKey.trim());
                  }
                  setShowKeyModal(false);
                }}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md transition"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* SEO Modal */}
      {showSeoModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0e172a] border border-slate-700 rounded-xl max-w-md w-full p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-3">Project SEO & Slug</h3>
            <form onSubmit={handleSaveSeo} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Project Title</label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  className="w-full bg-[#1e293b] border border-slate-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Vanity Slug</label>
                <input
                  type="text"
                  value={seoSlug}
                  onChange={(e) => setSeoSlug(e.target.value)}
                  className="w-full bg-[#1e293b] border border-slate-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Description</label>
                <textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-[#1e293b] border border-slate-700 rounded p-2 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowSeoModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSeo}
                  className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  {savingSeo ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GitHub Export Modal */}
      {showGithubModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0e172a] border border-slate-700 rounded-xl max-w-md w-full p-5 shadow-2xl text-xs">
            <h3 className="text-sm font-semibold text-white mb-3">Push to GitHub Repository</h3>
            {pushedRepoUrl ? (
              <div className="text-center py-4">
                <p className="text-emerald-400 font-medium mb-2">Repository created successfully!</p>
                <a
                  href={pushedRepoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 underline font-mono break-all"
                >
                  {pushedRepoUrl}
                </a>
                <button
                  type="button"
                  onClick={() => { setPushedRepoUrl(''); setShowGithubModal(false); }}
                  className="block mx-auto mt-4 px-4 py-1.5 bg-slate-800 text-white rounded"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handlePushToGithub} className="space-y-3">
                <div>
                  <label className="block text-slate-400 mb-1">GitHub Personal Access Token</label>
                  <input
                    type="password"
                    value={githubTokenInput}
                    onChange={(e) => setGithubTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className="w-full bg-[#1e293b] border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Repository Name</label>
                  <input
                    type="text"
                    value={githubRepoName}
                    onChange={(e) => setGithubRepoName(e.target.value)}
                    placeholder="my-cool-webapp"
                    className="w-full bg-[#1e293b] border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPriv"
                    checked={githubPrivate}
                    onChange={(e) => setGithubPrivate(e.target.checked)}
                  />
                  <label htmlFor="isPriv" className="text-slate-300">Make repository private</label>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowGithubModal(false)}
                    className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pushingGithub}
                    className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium"
                  >
                    {pushingGithub ? 'Pushing Repository...' : 'Create & Push'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* AI Requirements Chat Modal */}
      {showChatModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-3 md:p-4 z-50">
          <div className="bg-[#0e172a] border border-slate-700 rounded-2xl max-w-lg w-full h-[520px] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-[#0b1220]">
              <span className="text-xs font-semibold text-white tracking-wide">WEBTO Architecture Assistant</span>
              <button onClick={() => setShowChatModal(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>

            <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
              {chatMessages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-xl p-2.5 leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#182338] text-slate-200 border border-slate-700/60'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {chatChips.length > 0 && (
              <div className="px-3 py-1.5 bg-[#090e1a] border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto shrink-0">
                {chatChips.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendChatMessage(chip)}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 shrink-0 whitespace-nowrap"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            <div className="p-3 border-t border-slate-800 bg-[#0b1220] flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                placeholder="Ask architect to modify or plan features..."
                className="flex-1 bg-[#152033] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => handleSendChatMessage()}
                disabled={chatLoading || !chatInput.trim()}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs disabled:opacity-50"
              >
                Send
              </button>
              <button
                onClick={handleApplyChatChanges}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEBTO AI BRANDED ERROR & RETRY MODAL */}
      {errorModal.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#0b1220] border border-blue-500/30 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto text-xl font-bold shadow-lg shadow-blue-500/10">
              ✨
            </div>
            
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">{errorModal.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                {errorModal.message}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setErrorModal({ open: false, title: '', message: '' })}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorModal({ open: false, title: '', message: '' });
                  handleGenerate();
                }}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md transition"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
