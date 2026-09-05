import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Built-in GitHub icon to fix the Vercel/Vite build crash
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

  // Photo / Mockup Upload State
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Phase 12: Device Viewport & Inspector State
  const [deviceViewport, setDeviceViewport] = useState('desktop');
  const [inspectorActive, setInspectorActive] = useState(false);
  const [selectedElementInfo, setSelectedElementInfo] = useState(null);
  const [targetedPrompt, setTargetedPrompt] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef(null);

  // Phase 13: GitHub Export State
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [githubTokenInput, setGithubTokenInput] = useState(localStorage.getItem('gh_token') || '');
  const [githubRepoName, setGithubRepoName] = useState('');
  const [githubPrivate, setGithubPrivate] = useState(false);
  const [pushingGithub, setPushingGithub] = useState(false);
  const [pushedRepoUrl, setPushedRepoUrl] = useState('');

  // Phase 15: Public Visibility State
  const [isPublicProject, setIsPublicProject] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  // Phase 17: Speech Recognition Voice State
  const [isListening, setIsListening] = useState(false);

  // Phase 18: SEO & Vanity Domain Slug State
  const [showSeoModal, setShowSeoModal] = useState(false);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoSlug, setSeoSlug] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [savingSeo, setSavingSeo] = useState(false);

  // Credit Limit Upgrade Modal State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [refilling, setRefilling] = useState(false);

  // Chat / Requirements State
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatChips, setChatChips] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    loadProject();
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

  // Live progress engine & backend milestone logger
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
          `[${timestamp}] Synthesizing Tailwind design system & color scales...`,
          `[${timestamp}] Rendering responsive flex & grid viewports...`,
          `[${timestamp}] Building state management & reactive DOM events...`,
          `[${timestamp}] Parsing FontAwesome glyph icons and typography...`,
          `[${timestamp}] Compiling modular project files array...`,
          `[${timestamp}] Sanitizing execution sandbox & HTML5 entrypoint...`
        ];

        setLiveLogs((prevLogs) => {
          if (prevLogs.length >= 6) return [...prevLogs.slice(1), possibleLogs[Math.floor(Math.random() * possibleLogs.length)]];
          return [...prevLogs, possibleLogs[prevLogs.length % possibleLogs.length]];
        });
      }, 1400);
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

  useEffect(() => {
    const handleInspectorMessage = (e) => {
      if (e.data && e.data.type === 'ELEMENT_SELECTED') {
        setSelectedElementInfo(e.data.payload);
      }
    };

    window.addEventListener('message', handleInspectorMessage);
    return () => window.removeEventListener('message', handleInspectorMessage);
  }, []);

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
      alert('Please upload a valid image file (PNG, JPG, WEBP, etc.)');
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

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Backend route not found or server error.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update visibility');

      setIsPublicProject(data.isPublic);
    } catch (err) {
      alert(`Visibility Error: ${err.message}`);
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

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('SEO endpoint not deployed or invalid server response.');
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update SEO');

      setProject(data.project);
      if (data.entryHtml) {
        setEntryHtml(data.entryHtml);
        setIframeKey((prev) => prev + 1);
      }
      setShowSeoModal(false);
    } catch (err) {
      alert(`SEO Error: ${err.message}`);
    } finally {
      setSavingSeo(false);
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setPromptInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const openRequirementChat = (currentProj) => {
    setShowChatModal(true);
    if (chatMessages.length === 0) {
      const initialPrompt = [
        {
          role: 'assistant',
          content: `Hi! Let's plan or update **${currentProj?.name || 'your project'}**. Tell me any new features, layout changes, or styles you'd like to implement!`,
        }
      ];
      setChatMessages(initialPrompt);
      setChatChips(['Dark Fintech Dashboard', 'Add Interactive Charts', 'Add Checkout Flow']);
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

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Chat service unavailable.');
      }
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

    const authToken = token || localStorage.getItem('token');
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/generate/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          prompt: (text || 'Generate matching design based on attached image').trim(),
          image: selectedImage || null
        })
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Generation service encountered an error.');
      }
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403 || data.error?.toLowerCase().includes('credit') || data.error?.toLowerCase().includes('quota')) {
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

      if (setUser && data.remainingCredits !== undefined) {
        setUser((prev) => ({
          ...prev,
          credits: data.remainingCredits,
          freeBuildsUsed: (prev?.freeBuildsUsed ?? 0) + 1
        }));
      }

      setPromptInput('');
      handleRemoveImage();
      setSelectedElementInfo(null);
      setInspectorActive(false);
    } catch (err) {
      alert(`AI Generation Error: ${err.message}`);
    } finally {
      setTimeout(() => {
        setGenerating(false);
      }, 400);
    }
  };

  const handleTargetedElementEdit = (e) => {
    e.preventDefault();
    if (!targetedPrompt.trim() || !selectedElementInfo) return;

    const comprehensivePrompt = `
TARGETED COMPONENT MODIFICATION:
Selected Element Tag: <${selectedElementInfo.tagName.toLowerCase()}>
Selected Element HTML Snapshot:
${selectedElementInfo.outerHTML.slice(0, 500)}

Requested User Modification:
${targetedPrompt}
`;
    handleGenerate(comprehensivePrompt);
    setTargetedPrompt('');
  };

  // Safe Deploy Handler: No page unloads, no router redirect loops
  const handleDeploy = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!entryHtml) {
      alert('Generate code first before deploying!');
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

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Deployment service unavailable.');
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to deploy');

      setProject(data.project);

      const targetUrl = data.deployedUrl;
      if (targetUrl) {
        const opened = window.open(targetUrl, '_blank', 'noopener,noreferrer');
        if (!opened) {
          alert(`Application Deployed Successfully!\nAccess URL: ${targetUrl}`);
        }
      }
    } catch (err) {
      alert(`Deployment Error: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!entryHtml && (!files || files.length === 0)) {
      alert('No code available to export!');
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
      alert('Failed to generate project ZIP.');
    }
  };

  const handlePushToGithub = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!githubTokenInput.trim() || !githubRepoName.trim()) {
      alert('GitHub token and repository name are required.');
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
      alert(`GitHub Export Error: ${err.message}`);
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

  return (
    <div className="flex flex-col h-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      {/* Top Navbar */}
      <header className="h-14 border-b border-slate-800/80 px-4 flex items-center justify-between bg-[#0b1324] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            &larr; Dashboard
          </button>
          <span className="text-sm font-semibold text-white tracking-wide">
            {project?.name || 'Workspace Canvas'}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-400 border border-blue-800/40">
            {project?.type || 'FULL_STACK'}
          </span>
        </div>

        {/* Viewport, Visibility & Action Controls */}
        <div className="flex items-center gap-2">
          {/* Viewport Switchers */}
          <div className="hidden sm:flex items-center bg-slate-900 border border-slate-800 rounded p-0.5 text-xs">
            <button
              onClick={() => setDeviceViewport('desktop')}
              className={`px-2 py-1 rounded ${deviceViewport === 'desktop' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Desktop
            </button>
            <button
              onClick={() => setDeviceViewport('tablet')}
              className={`px-2 py-1 rounded ${deviceViewport === 'tablet' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Tablet
            </button>
            <button
              onClick={() => setDeviceViewport('mobile')}
              className={`px-2 py-1 rounded ${deviceViewport === 'mobile' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Mobile
            </button>
          </div>

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

          {/* DEPLOY BUTTON */}
          <button
            type="button"
            onClick={(e) => handleDeploy(e)}
            disabled={deploying || !entryHtml}
            className="text-xs font-medium px-3.5 py-1.5 rounded bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm disabled:opacity-50 transition"
          >
            {deploying ? 'Deploying...' : 'Deploy'}
          </button>
        </div>
      </header>

      {/* Main Workspace Split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Generation Control Panel */}
        <aside className="w-80 border-r border-slate-800 bg-[#090f1d] flex flex-col p-4 shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Prompt Studio</span>
            <button
              onClick={() => openRequirementChat(project)}
              className="text-xs px-2 py-0.5 rounded bg-blue-900/60 hover:bg-blue-800/80 text-blue-300 border border-blue-700/50 transition"
            >
              Requirements Chat
            </button>
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

          {/* Image / Mockup Preview */}
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

          {/* Live Generation Pipeline Progress */}
          {generating && (
            <div className="mt-4 p-3 rounded-lg bg-[#0e1627] border border-blue-900/50">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-blue-400 font-medium">Stage {GENERATION_STAGES[currentStageIndex]?.stage}</span>
                <span className="text-slate-400 font-mono">{generateProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 mb-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${generateProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-300 font-medium mb-1">
                {GENERATION_STAGES[currentStageIndex]?.title}
              </p>
              <div className="bg-black/40 rounded p-2 text-[10px] font-mono text-slate-400 space-y-0.5 max-h-24 overflow-y-auto">
                {liveLogs.map((log, i) => (
                  <div key={i} className="truncate">{log}</div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Right Side: Tab Switcher & Sandbox Preview */}
        <main className="flex-1 flex flex-col bg-[#0b101d] overflow-hidden">
          {/* Top Canvas Tabs */}
          <div className="h-10 border-b border-slate-800/90 px-4 flex items-center justify-between bg-[#080d19] shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`text-xs px-3 py-1 rounded font-medium transition ${
                  activeTab === 'preview' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                Live Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`text-xs px-3 py-1 rounded font-medium transition ${
                  activeTab === 'code' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                Code Editor ({files.length || (entryHtml ? 1 : 0)} files)
              </button>
            </div>

            {activeTab === 'code' && (
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-xs px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            )}
          </div>

          {/* Canvas Display Body */}
          <div className="flex-1 overflow-hidden relative flex justify-center items-center p-2 bg-[#050811]">
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
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d1527] text-slate-400">
                    <p className="text-sm">No preview generated yet.</p>
                    <p className="text-xs text-slate-500 mt-1">Enter requirements and click "Generate / Update Code".</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex bg-[#0d1627] rounded-lg overflow-hidden border border-slate-800">
                {/* File Tree List */}
                <div className="w-48 border-r border-slate-800 bg-[#09101f] p-2 overflow-y-auto">
                  <div className="text-[11px] font-semibold text-slate-400 px-2 py-1 uppercase">Files</div>
                  {files.length > 0 ? (
                    files.map((f, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedFile(f)}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs truncate transition ${
                          selectedFile?.name === f.name ? 'bg-blue-600/30 text-blue-400' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        📄 {f.name}
                      </button>
                    ))
                  ) : (
                    <button
                      type="button"
                      className="w-full text-left px-2 py-1.5 rounded text-xs text-blue-400 bg-blue-600/20 truncate"
                    >
                      📄 index.html
                    </button>
                  )}
                </div>

                {/* Editor Content Area */}
                <div className="flex-1 p-4 overflow-auto">
                  <pre className="text-xs font-mono text-slate-200 leading-relaxed whitespace-pre">
                    {selectedFile ? selectedFile.content : entryHtml}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

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
    </div>
  );
}
