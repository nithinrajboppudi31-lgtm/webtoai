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

      // Smooth progress calculation with dynamic stepping
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

      // Stream realistic backend console logs
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

  // Listen for clicks inside the iframe
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

  // Safe Deploy Handler: No unwanted page resets or forced redirects to home
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
          Authorization: `Bearer ${authToken}`
        }
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
          alert(`Application Deployed!\nLive URL: ${targetUrl}`);
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
    e.preventDefault();
    if (!githubTokenInput.trim() || !githubRepoName.trim()) {
      alert('Please provide your GitHub Token and a Repository Name.');
      return;
    }

    setPushingGithub(true);
    setPushedRepoUrl('');
    try {
      localStorage.setItem('gh_token', githubTokenInput.trim());
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

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('GitHub integration service unavailable.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to push to GitHub');

      setPushedRepoUrl(data.repoUrl);
    } catch (err) {
      alert(`GitHub Error: ${err.message}`);
    } finally {
      setPushingGithub(false);
    }
  };

  const handleCopyCode = () => {
    if (selectedFile?.content) {
      navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getAugmentedHtml = () => {
    if (!entryHtml) return '';

    const inspectorScript = `
      <script>
        (function() {
          let selectedElement = null;
          document.addEventListener('mouseover', function(e) {
            if (${inspectorActive}) {
              e.stopPropagation();
              e.target.style.outline = '2px dashed #3b82f6';
              e.target.style.cursor = 'crosshair';
            }
          }, true);

          document.addEventListener('mouseout', function(e) {
            if (${inspectorActive}) {
              e.stopPropagation();
              e.target.style.outline = '';
            }
          }, true);

          document.addEventListener('click', function(e) {
            if (${inspectorActive}) {
              e.preventDefault();
              e.stopPropagation();
              selectedElement = e.target;
              window.parent.postMessage({
                type: 'ELEMENT_SELECTED',
                payload: {
                  tagName: selectedElement.tagName,
                  outerHTML: selectedElement.outerHTML
                }
              }, '*');
            }
          }, true);
        })();
      </script>
    `;

    if (entryHtml.includes('</body>')) {
      return entryHtml.replace('</body>', `${inspectorScript}</body>`);
    }
    return `${entryHtml}${inspectorScript}`;
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans">
      {/* Top Workspace Navigation Bar */}
      <header className="h-14 border-b border-slate-800 bg-[#0b1324] px-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
            title="Back to Dashboard"
          >
            ←
          </button>
          <span className="font-semibold text-xs tracking-wide text-white truncate max-w-[200px] sm:max-w-xs">
            {project?.name || 'Application Builder'}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase font-mono">
            {project?.type || 'FULL_STACK'}
          </span>
        </div>

        {/* Viewport, Inspector & Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setDeviceViewport('desktop')}
              className={`px-2.5 py-1 rounded text-xs transition ${
                deviceViewport === 'desktop' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setDeviceViewport('tablet')}
              className={`px-2.5 py-1 rounded text-xs transition ${
                deviceViewport === 'tablet' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tablet
            </button>
            <button
              type="button"
              onClick={() => setDeviceViewport('mobile')}
              className={`px-2.5 py-1 rounded text-xs transition ${
                deviceViewport === 'mobile' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mobile
            </button>
          </div>

          <button
            type="button"
            onClick={() => setInspectorActive(!inspectorActive)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs transition flex items-center gap-1.5 ${
              inspectorActive
                ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>Inspector</span>
          </button>

          <button
            type="button"
            onClick={() => openRequirementChat(project)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition cursor-pointer"
          >
            Chat
          </button>

          <button
            type="button"
            onClick={() => setShowSeoModal(true)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition cursor-pointer"
          >
            Settings
          </button>

          <button
            type="button"
            onClick={() => setShowGithubModal(true)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadZip}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition cursor-pointer"
            title="Download ZIP Archive"
          >
            Export ZIP
          </button>

          <button
            type="button"
            disabled={deploying}
            onClick={handleDeploy}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
          >
            <span>{deploying ? 'Deploying...' : 'Deploy'}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        <main className="flex-1 flex flex-col bg-[#050811] relative overflow-hidden">
          {/* Sub Navigation */}
          <div className="h-10 border-b border-slate-800/80 bg-[#080d1a] px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  activeTab === 'preview' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Live Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  activeTab === 'code' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Code Editor
              </button>
            </div>

            {activeTab === 'code' && (
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                {copied ? 'Copied!' : 'Copy File'}
              </button>
            )}
          </div>

          {/* Inspector Component Editor Overlay */}
          {inspectorActive && selectedElementInfo && (
            <div className="p-2.5 bg-blue-950/80 border-b border-blue-500/40 flex items-center justify-between gap-3 text-xs z-10">
              <div className="flex items-center gap-2 truncate">
                <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-mono text-[10px] uppercase">
                  {selectedElementInfo.tagName}
                </span>
                <span className="text-blue-200 truncate max-w-sm hidden sm:inline">
                  {selectedElementInfo.outerHTML.slice(0, 70)}...
                </span>
              </div>

              <form onSubmit={handleTargetedElementEdit} className="flex items-center gap-2 flex-1 max-w-md">
                <input
                  type="text"
                  value={targetedPrompt}
                  onChange={(e) => setTargetedPrompt(e.target.value)}
                  placeholder="Modify this selected element..."
                  className="flex-1 px-3 py-1 text-xs bg-slate-900 text-white border border-blue-500/40 rounded-lg focus:outline-none focus:border-blue-400"
                />
                <button
                  type="submit"
                  disabled={generating}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedElementInfo(null)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </form>
            </div>
          )}

          {/* Tab Views */}
          <div className="flex-1 flex items-center justify-center p-2 relative overflow-auto bg-[#04060b]">
            {activeTab === 'preview' ? (
              <div
                className={`h-full bg-white rounded-xl shadow-2xl transition-all duration-300 overflow-hidden relative ${
                  deviceViewport === 'desktop'
                    ? 'w-full'
                    : deviceViewport === 'tablet'
                    ? 'w-[768px] max-w-full'
                    : 'w-[375px] max-w-full'
                }`}
              >
                {entryHtml ? (
                  <iframe
                    key={iframeKey}
                    ref={iframeRef}
                    title="Live Preview"
                    srcDoc={getAugmentedHtml()}
                    sandbox="allow-scripts allow-same-origin allow-modals"
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#070d19] text-slate-400 p-6 text-center">
                    <p className="text-sm mb-1">Canvas is empty</p>
                    <p className="text-xs text-slate-500">
                      Enter a prompt below and start building your interactive web application.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex bg-[#0c1322] rounded-xl border border-slate-800 overflow-hidden">
                {/* File Tree */}
                <div className="w-48 border-r border-slate-800 bg-[#080e1a] p-2 overflow-y-auto">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-2 py-1 mb-1">
                    Project Files
                  </div>
                  {files && files.length > 0 ? (
                    files.map((file, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedFile(file)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono truncate transition cursor-pointer ${
                          selectedFile?.name === file.name
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                      >
                        {file.name}
                      </button>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 px-2 py-1">No files generated yet</div>
                  )}
                </div>

                {/* File Code Viewer */}
                <div className="flex-1 p-3 overflow-auto bg-[#070b14]">
                  <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {selectedFile?.content || entryHtml || '// Source code will appear here'}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* AI Generator Bottom Bar */}
          <div className="p-3 bg-[#080d1c] border-t border-slate-800/80">
            {generating && (
              <div className="mb-2 p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/20">
                <div className="flex justify-between items-center text-xs font-semibold text-blue-300 mb-1">
                  <span>{GENERATION_STAGES[currentStageIndex]?.title || 'Synthesizing Application...'}</span>
                  <span>{generateProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${generateProgress}%` }}
                  />
                </div>
                {liveLogs.length > 0 && (
                  <div className="mt-2 text-[10px] font-mono text-slate-400 truncate">
                    {liveLogs[liveLogs.length - 1]}
                  </div>
                )}
              </div>
            )}

            {imagePreview && (
              <div className="mb-2 flex items-center gap-2 p-1.5 bg-slate-900 border border-slate-700 rounded-lg w-fit">
                <img src={imagePreview} alt="Mockup" className="w-8 h-8 rounded object-cover" />
                <span className="text-xs text-slate-300">Image attached</span>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="p-1 hover:text-red-400 text-slate-400 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerate();
              }}
              className="flex items-center gap-2"
            >
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
                className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition cursor-pointer text-xs"
                title="Attach UI Mockup"
              >
                Img
              </button>

              <button
                type="button"
                onClick={handleVoiceInput}
                className={`p-2 rounded-lg border text-xs transition cursor-pointer ${
                  isListening
                    ? 'bg-rose-600/20 border-rose-500 text-rose-400 animate-pulse'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="Voice Input"
              >
                {isListening ? 'Stop' : 'Mic'}
              </button>

              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Describe additions or revisions (e.g., 'Make the header sticky and add a contact modal')..."
                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={generating}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
              >
                {generating ? 'Building...' : 'Update Project'}
              </button>
            </form>
          </div>
        </main>
      </div>

      {/* GitHub Export Modal */}
      {showGithubModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0c1322] border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <GithubIcon className="w-4 h-4" />
                <span>Export to GitHub</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGithubModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {pushedRepoUrl ? (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl mb-3 text-center text-xs">
                <p className="text-green-400 font-semibold mb-1">Repository Created!</p>
                <a
                  href={pushedRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline font-mono"
                >
                  {pushedRepoUrl}
                </a>
              </div>
            ) : (
              <form onSubmit={handlePushToGithub} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">GitHub Personal Access Token</label>
                  <input
                    type="password"
                    required
                    value={githubTokenInput}
                    onChange={(e) => setGithubTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Repository Name</label>
                  <input
                    type="text"
                    required
                    value={githubRepoName}
                    onChange={(e) => setGithubRepoName(e.target.value)}
                    placeholder="my-cool-ai-app"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="ghPrivate"
                    checked={githubPrivate}
                    onChange={(e) => setGithubPrivate(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                  />
                  <label htmlFor="ghPrivate" className="text-slate-300 select-none">Private Repository</label>
                </div>

                <button
                  type="submit"
                  disabled={pushingGithub}
                  className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {pushingGithub ? 'Pushing Repository...' : 'Create & Push'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SEO & Settings Modal */}
      {showSeoModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0c1322] border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-white text-sm">Project Settings</span>
              <button
                type="button"
                onClick={() => setShowSeoModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 pb-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="block text-xs font-semibold text-white">Public Visibility</span>
                <span className="text-[11px] text-slate-400">Share project preview publicly</span>
              </div>
              <button
                type="button"
                disabled={updatingVisibility}
                onClick={handleToggleVisibility}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  isPublicProject ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {updatingVisibility ? 'Saving...' : isPublicProject ? 'Public' : 'Private'}
              </button>
            </div>

            <form onSubmit={handleSaveSeo} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Slug</label>
                <input
                  type="text"
                  value={seoSlug}
                  onChange={(e) => setSeoSlug(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={savingSeo}
                className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                {savingSeo ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChatModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0c1322] border border-slate-800 rounded-2xl max-w-lg w-full h-[500px] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-3.5 border-b border-slate-800 flex justify-between items-center bg-[#090f1d]">
              <span className="font-bold text-xs text-white">Project Planner Chat</span>
              <button
                type="button"
                onClick={() => setShowChatModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl p-2.5 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-900 border border-slate-800 text-slate-200'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {chatChips.length > 0 && (
              <div className="px-3 py-2 bg-slate-900/60 border-t border-slate-800 flex gap-1.5 overflow-x-auto">
                {chatChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendChatMessage(chip)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] whitespace-nowrap transition cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            <div className="p-2.5 border-t border-slate-800 bg-[#090f1d] flex flex-col gap-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChatMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask for recommendations..."
                  className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  Send
                </button>
              </form>

              <button
                type="button"
                onClick={handleApplyChatChanges}
                className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Apply Plan & Generate Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Limit / Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0c1322] border border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1">Free Limit Reached</h3>
            <p className="text-xs text-slate-400 mb-4">
              You have utilized your free generation credits.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Go to Dashboard
              </button>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="w-full py-1.5 bg-slate-900 text-slate-300 text-xs rounded-lg transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
