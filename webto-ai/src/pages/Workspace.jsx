import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const API_BASE = 'https://webtoai-backend.onrender.com';

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

  // Smooth realistic progress counter when generating
  useEffect(() => {
    let interval = null;
    if (generating) {
      setGenerateProgress(10);
      interval = setInterval(() => {
        setGenerateProgress((prev) => {
          if (prev >= 95) return 95;
          const increment = Math.floor(Math.random() * 8) + 3;
          return Math.min(prev + increment, 95);
        });
      }, 350);
    } else {
      setGenerateProgress(0);
    }
    return () => {
      if (interval) clearInterval(interval);
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
      }, 300);
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

  const handleDeploy = async () => {
    if (!entryHtml) {
      alert('Generate code first before deploying!');
      return;
    }

    const authToken = token || localStorage.getItem('token');
    setDeploying(true);
    try {
      const res = await fetch(`${API_BASE}/api/deploy/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Deployment service unavailable.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to deploy');

      setProject(data.project);
      window.open(data.deployedUrl, '_blank');
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
    if (!inspectorActive) return entryHtml;

    const inspectorScript = `
      <style>
        .webto-inspect-hover {
          outline: 2px dashed #3b82f6 !important;
          outline-offset: -2px !important;
          cursor: crosshair !important;
        }
        .webto-inspect-selected {
          outline: 3px solid #6366f1 !important;
          outline-offset: -2px !important;
          background-color: rgba(99, 102, 241, 0.15) !important;
        }
      </style>
      <script>
        document.addEventListener('mouseover', function(e) {
          if (!e.target || e.target === document.body || e.target === document.documentElement) return;
          e.target.classList.add('webto-inspect-hover');
        }, true);

        document.addEventListener('mouseout', function(e) {
          if (e.target) e.target.classList.remove('webto-inspect-hover');
        }, true);

        document.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();

          document.querySelectorAll('.webto-inspect-selected').forEach(function(el) {
            el.classList.remove('webto-inspect-selected');
          });
          e.target.classList.add('webto-inspect-selected');

          window.parent.postMessage({
            type: 'ELEMENT_SELECTED',
            payload: {
              tagName: e.target.tagName || 'DIV',
              classNames: e.target.className || '',
              outerHTML: (e.target.outerHTML || '').slice(0, 1000)
            }
          }, '*');
        }, true);
      </script>
    `;

    if (entryHtml.includes('</body>')) {
      return entryHtml.replace('</body>', `${inspectorScript}</body>`);
    }
    return `${entryHtml}${inspectorScript}`;
  };

  const toggleInspector = () => {
    const nextState = !inspectorActive;
    setInspectorActive(nextState);
    if (!nextState) {
      setSelectedElementInfo(null);
    }
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-slate-950 text-slate-100 font-sans relative">
      {/* Top Workspace Bar */}
      <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3 text-sm">
          <button
            onClick={() => navigate('/projects')}
            className="text-slate-400 hover:text-white transition flex items-center gap-1"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <span className="font-semibold text-white truncate max-w-xs">
            {project?.name || 'Workspace'}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {project?.type || 'WEB_APP'}
          </span>
        </div>

        {/* View Switchers + Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => openRequirementChat(project)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center gap-1.5 transition"
          >
            <i className="fa-solid fa-comments"></i>
            AI Planner
          </button>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition ${
                activeTab === 'preview'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className="fa-regular fa-eye"></i>
              Live Preview
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition ${
                activeTab === 'code'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className="fa-solid fa-code"></i>
              Code Editor
            </button>
          </div>

          <button
            onClick={handleDeploy}
            disabled={deploying || !entryHtml}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition disabled:opacity-50 shadow"
          >
            {deploying ? (
              <>
                <i className="fa-solid fa-spinner animate-spin"></i>
                Deploying...
              </>
            ) : (
              <>
                <i className="fa-solid fa-rocket"></i>
                {project?.isDeployed ? 'Redeploy' : 'Deploy'}
              </>
            )}
          </button>

          {/* Phase 18: SEO & Vanity URL Button */}
          <button
            onClick={() => setShowSeoModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
            title="SEO & Vanity Slug Settings"
          >
            <i className="fa-solid fa-sliders text-blue-400"></i>
            SEO & URL
          </button>

          {/* Phase 15: Public Showcase Visibility Toggle */}
          <button
            onClick={handleToggleVisibility}
            disabled={updatingVisibility}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition ${
              isPublicProject
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title={isPublicProject ? 'Visible on Community Explore' : 'Private to you'}
          >
            <i className={`fa-solid ${isPublicProject ? 'fa-globe' : 'fa-lock'}`}></i>
            <span>{updatingVisibility ? 'Saving...' : isPublicProject ? 'Public' : 'Private'}</span>
          </button>

          {/* Phase 13: Push to GitHub Button */}
          <button
            onClick={() => {
              setGithubRepoName(project?.name?.toLowerCase().replace(/\s+/g, '-') || 'my-app');
              setPushedRepoUrl('');
              setShowGithubModal(true);
            }}
            disabled={!entryHtml && (!files || files.length === 0)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-40"
            title="Push to GitHub"
          >
            <i className="fa-brands fa-github"></i>
            GitHub
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={!entryHtml && (!files || files.length === 0)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-40"
            title="Download Project ZIP"
          >
            <i className="fa-solid fa-download"></i>
            Export
          </button>
        </div>
      </div>

      {/* PHASE 12: Viewport & Element Inspector Bar */}
      {activeTab === 'preview' && (
        <div className="px-6 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setDeviceViewport('desktop')}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
                deviceViewport === 'desktop' ? 'bg-blue-600 text-white font-semibold shadow' : 'hover:text-white'
              }`}
            >
              <i className="fa-solid fa-desktop"></i>
              <span>Desktop</span>
            </button>
            <button
              onClick={() => setDeviceViewport('tablet')}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
                deviceViewport === 'tablet' ? 'bg-blue-600 text-white font-semibold shadow' : 'hover:text-white'
              }`}
            >
              <i className="fa-solid fa-tablet-screen-button"></i>
              <span>Tablet (768px)</span>
            </button>
            <button
              onClick={() => setDeviceViewport('mobile')}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
                deviceViewport === 'mobile' ? 'bg-blue-600 text-white font-semibold shadow' : 'hover:text-white'
              }`}
            >
              <i className="fa-solid fa-mobile-screen"></i>
              <span>Mobile (375px)</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleInspector}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                inspectorActive
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/25 ring-2 ring-indigo-400/50'
                  : 'bg-slate-950 text-slate-300 hover:text-white border-slate-800'
              }`}
            >
              <i className="fa-solid fa-arrow-pointer text-[11px]"></i>
              <span>{inspectorActive ? 'Click any Element in Canvas' : 'Inspect Element'}</span>
            </button>

            <button
              onClick={() => setIframeKey((prev) => prev + 1)}
              className="p-1.5 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800"
              title="Reload Preview"
            >
              <i className="fa-solid fa-rotate-right text-xs"></i>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative bg-slate-900/20">
        {generating && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-5">
            <div className="relative flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div>
              <i className="fa-solid fa-wand-magic-sparkles text-blue-400 text-2xl absolute"></i>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white font-mono tracking-tight">{generateProgress}</span>
                <span className="text-sm font-bold text-blue-400 font-mono">%</span>
              </div>
              <div className="w-56 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-300 ease-out"
                  style={{ width: `${generateProgress}%` }}
                ></div>
              </div>
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-semibold text-white">Synthesizing Updates with WEBTO AI</h3>
              <p className="text-xs text-slate-400">
                {generateProgress < 35
                  ? 'Analyzing prompt requirements & visual inputs...'
                  : generateProgress < 70
                  ? 'Compiling responsive layouts & modules...'
                  : generateProgress < 95
                  ? 'Synthesizing source files & preview...'
                  : 'Finalizing live canvas updates...'}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'preview' ? (
          <div className="flex-1 w-full h-full flex items-center justify-center p-4 overflow-auto bg-slate-950/90 relative">
            {entryHtml ? (
              <div
                style={{
                  width:
                    deviceViewport === 'mobile'
                      ? '375px'
                      : deviceViewport === 'tablet'
                      ? '768px'
                      : '100%',
                  height:
                    deviceViewport === 'mobile'
                      ? '667px'
                      : deviceViewport === 'tablet'
                      ? '900px'
                      : '100%',
                  maxWidth: '100%',
                  maxHeight: '100%',
                }}
                className={`transition-all duration-300 flex-shrink-0 flex flex-col bg-white overflow-hidden shadow-2xl ${
                  deviceViewport === 'mobile'
                    ? 'border-[10px] border-slate-800 rounded-[36px] shadow-indigo-500/10'
                    : deviceViewport === 'tablet'
                    ? 'border-[8px] border-slate-800 rounded-2xl shadow-indigo-500/10'
                    : 'rounded-none border-none'
                }`}
              >
                <iframe
                  key={iframeKey}
                  ref={iframeRef}
                  title="Live Canvas Preview"
                  srcDoc={getAugmentedHtml()}
                  className="w-full h-full border-none bg-white"
                  sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3">
                <i className="fa-solid fa-wand-magic-sparkles text-4xl text-blue-500/80 animate-pulse"></i>
                <p className="text-base font-medium text-slate-300">Ready to build {project?.name}</p>
                <button
                  onClick={() => openRequirementChat(project)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Start AI Discovery Session
                </button>
              </div>
            )}

            {selectedElementInfo && (
              <div className="absolute bottom-6 right-6 w-96 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl z-40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono text-[10px] font-bold uppercase">
                      &lt;{selectedElementInfo.tagName.toLowerCase()}&gt;
                    </span>
                    <span className="text-xs font-semibold text-white">Element Selected</span>
                  </div>
                  <button
                    onClick={() => setSelectedElementInfo(null)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <form onSubmit={handleTargetedElementEdit} className="space-y-2.5">
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Type instructions to specifically modify or restyle this element:
                  </p>
                  <input
                    type="text"
                    placeholder="e.g. Change to purple gradient, add pulse animation..."
                    value={targetedPrompt}
                    onChange={(e) => setTargetedPrompt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedElementInfo(null)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={generating || !targetedPrompt.trim()}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <i className="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
                      Apply Edit
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            <div className="w-56 bg-slate-950 border-r border-slate-800 flex flex-col">
              <div className="p-3 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 flex items-center gap-2">
                <i className="fa-regular fa-folder-open text-blue-400"></i>
                Project Files
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {files.length > 0 ? (
                  files.map((file, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedFile(file)}
                      className={`w-full text-left px-3 py-2 rounded text-xs flex items-center gap-2 transition ${
                        selectedFile?.name === file.name
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-medium'
                          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                      }`}
                    >
                      <i className="fa-regular fa-file-code text-blue-400"></i>
                      <span className="truncate">{file.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-xs text-slate-600 text-center">No files yet</div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-slate-950">
              <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>{selectedFile?.name || 'No file selected'}</span>
                {selectedFile && (
                  <button
                    onClick={handleCopyCode}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition flex items-center gap-1.5"
                  >
                    <i className={`fa-regular ${copied ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
              <div className="flex-1 p-4 overflow-auto font-mono text-xs text-slate-200 leading-relaxed select-text">
                <pre className="whitespace-pre-wrap">{selectedFile?.content || '// Select a file from the explorer'}</pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Phase 18: SEO & Vanity Domain Slug Modal */}
      {showSeoModal && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setShowSeoModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-lg">
                <i className="fa-solid fa-globe"></i>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">SEO & Vanity URL Settings</h3>
                <p className="text-xs text-slate-400">Customize search ranking tags and custom link slug</p>
              </div>
            </div>

            <form onSubmit={handleSaveSeo} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Live URL Vanity Slug</label>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl overflow-hidden focus-within:border-blue-500">
                  <span className="px-3 text-slate-500 text-[11px] select-none border-r border-slate-800">
                    localhost:5000/live/
                  </span>
                  <input
                    type="text"
                    placeholder="my-awesome-app"
                    value={seoSlug}
                    onChange={(e) => setSeoSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    required
                    className="flex-1 px-3 py-2 bg-transparent text-white placeholder-slate-600 focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Alphanumeric characters and hyphens only.
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Page Title (&lt;title&gt;)</label>
                <input
                  type="text"
                  placeholder="e.g. Apex SaaS - Next Gen Intelligence"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Meta Description (SEO & Social Sharing)</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Build production apps at 10x developer velocity with modular generative architectures..."
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Google Search Preview</span>
                <p className="text-xs font-semibold text-blue-400 truncate">{seoTitle || 'Project Title'}</p>
                <p className="text-[11px] text-emerald-400 truncate">https://webtoai-backend.onrender.com/live/{seoSlug || 'my-app'}</p>
                <p className="text-[11px] text-slate-400 line-clamp-2">{seoDescription || 'No description provided.'}</p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSeoModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSeo}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition flex items-center gap-2 shadow disabled:opacity-50"
                >
                  {savingSeo ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin"></i>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check"></i>
                      Save SEO Settings
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Phase 13: GitHub Repository Push Modal */}
      {showGithubModal && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setShowGithubModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white text-xl">
                <i className="fa-brands fa-github"></i>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Push to GitHub</h3>
                <p className="text-xs text-slate-400">Create a repository with all generated code</p>
              </div>
            </div>

            {pushedRepoUrl ? (
              <div className="space-y-4 py-3 text-center">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs">
                  <i className="fa-solid fa-circle-check text-lg mb-1 block"></i>
                  Repository successfully created and pushed!
                </div>
                <a
                  href={pushedRepoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square"></i>
                  Open GitHub Repository
                </a>
              </div>
            ) : (
              <form onSubmit={handlePushToGithub} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">GitHub Personal Access Token</label>
                  <input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxx..."
                    value={githubTokenInput}
                    onChange={(e) => setGithubTokenInput(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Needs <code>repo</code> scope permission.
                  </span>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Repository Name</label>
                  <input
                    type="text"
                    placeholder="my-cool-project"
                    value={githubRepoName}
                    onChange={(e) => setGithubRepoName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300 pt-1">
                  <input
                    type="checkbox"
                    checked={githubPrivate}
                    onChange={(e) => setGithubPrivate(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
                  />
                  <span>Make repository private</span>
                </label>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={pushingGithub}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {pushingGithub ? (
                      <>
                        <i className="fa-solid fa-spinner animate-spin"></i>
                        Creating & Pushing Code...
                      </>
                    ) : (
                      <>
                        <i className="fa-brands fa-github"></i>
                        Create & Push Repo
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Credit Limit Upgrade Modal */}
      {showUpgradeModal && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center">
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
              <i className="fa-solid fa-bolt text-2xl"></i>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Build Limit Reached</h2>
            <p className="text-slate-400 text-xs sm:text-sm max-w-sm mx-auto mb-6">
              You've utilized all available generation credits on your current plan. Top up your account to continue building with WEBTO AI autonomy.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate('/credits')}
                className="w-full py-3 px-5 bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-bolt"></i>
                View Plans & Upgrade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Discovery & Requirements Modal */}
      {showChatModal && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl h-[600px] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowChatModal(false)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-arrow-left"></i>
                  <span>Back</span>
                </button>
                <div className="h-4 w-px bg-slate-800"></div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                    <i className="fa-solid fa-robot text-xs"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-tight">AI Project Architect</h3>
                    <p className="text-[11px] text-slate-400">Plan requirements or specify real-time changes</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {chatMessages.length > 1 && (
                  <button
                    onClick={handleApplyChatChanges}
                    disabled={generating}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow"
                  >
                    <i className="fa-solid fa-bolt"></i>
                    Apply Changes
                  </button>
                )}
                <button
                  onClick={() => setShowChatModal(false)}
                  className="text-slate-400 hover:text-white transition p-1.5 rounded-lg hover:bg-slate-800"
                >
                  <i className="fa-solid fa-xmark text-base"></i>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/60'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 text-slate-400 rounded-2xl px-4 py-2 text-xs flex items-center gap-2 border border-slate-700/60">
                    <i className="fa-solid fa-circle-notch animate-spin"></i>
                    Architect is responding...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {chatChips.length > 0 && !chatLoading && (
              <div className="px-4 py-2 bg-slate-950/40 border-t border-slate-800/60 flex flex-wrap gap-1.5">
                {chatChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendChatMessage(chip)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full text-[11px] transition border border-slate-700"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            )}

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-col gap-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChatMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Describe adjustments or respond to the architect..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                  className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition disabled:opacity-40"
                >
                  Send
                </button>
              </form>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
                <button
                  onClick={() => setShowChatModal(false)}
                  className="hover:text-slate-200 transition"
                >
                  ← Return to workspace without building
                </button>
                <button
                  onClick={handleApplyChatChanges}
                  className="text-emerald-400 font-semibold hover:text-emerald-300 transition flex items-center gap-1"
                >
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  Apply Chat Specifications & Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Prompt Bar with Image Mockup Upload & Speech-to-Text */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col items-center">
        {/* Photo Preview Thumbnail */}
        {imagePreview && (
          <div className="mb-2.5 flex items-center gap-2.5 bg-slate-900 border border-blue-500/40 px-3 py-1.5 rounded-2xl max-w-4xl w-full">
            <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-700 shrink-0 bg-black">
              <img src={imagePreview} alt="Design Mockup" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-blue-400 truncate">Design Mockup / Screenshot Attached</p>
              <p className="text-[10px] text-slate-400">AI will inspect and recreate this visual interface</p>
            </div>
            <button
              type="button"
              onClick={handleRemoveImage}
              className="p-1 text-slate-400 hover:text-red-400 transition rounded-lg hover:bg-slate-800"
              title="Remove Attached Image"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleGenerate();
          }}
          className="relative flex items-center max-w-4xl w-full mx-auto"
        >
          {/* Attach Image Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={generating}
            className="absolute left-3 p-1.5 rounded-lg text-slate-400 hover:text-blue-400 transition hover:bg-slate-800 disabled:opacity-40"
            title="Upload Design Image / Screenshot"
          >
            <i className="fa-solid fa-image text-sm"></i>
          </button>

          <input
            type="text"
            placeholder={imagePreview ? "Add instructions for this design image (optional)..." : "Direct quick prompt, voice instruction, or enhancement..."}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            disabled={generating}
            className="w-full pl-11 pr-44 py-3 bg-slate-900 border border-slate-800 rounded-full text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition disabled:opacity-50 shadow-inner"
          />

          <div className="absolute right-1.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleVoiceInput}
              disabled={generating}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition border ${
                isListening
                  ? 'bg-red-500/20 text-red-400 border-red-500 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:text-white'
              }`}
              title={isListening ? 'Listening...' : 'Click to Speak Prompt'}
            >
              <i className={`fa-solid ${isListening ? 'fa-microphone-lines' : 'fa-microphone'}`}></i>
            </button>

            <button
              type="submit"
              disabled={generating || (!promptInput.trim() && !selectedImage)}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-full transition disabled:opacity-40 shadow flex items-center gap-2"
            >
              {generating ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin"></i>
                  Building...
                </>
              ) : (
                <>
                  Generate
                  <i className="fa-solid fa-paper-plane text-[10px]"></i>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
