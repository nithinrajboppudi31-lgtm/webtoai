import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

// Read multiple keys from GEMINI_API_KEYS (comma-separated) or single GEMINI_API_KEY
const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
const API_KEYS = rawKeys.split(',').map((k) => k.trim()).filter(Boolean);

let currentKeyIndex = 0;

// Dynamic client provider based on the current active key index
function getAiClient() {
  const activeKey = API_KEYS[currentKeyIndex] || process.env.GEMINI_API_KEY;
  return new GoogleGenAI({ apiKey: activeKey });
}

function rotateToNextKey() {
  if (API_KEYS.length > 1) {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    console.log(`[AI SERVICE] Switched active Gemini API Key to index #${currentKeyIndex + 1} of ${API_KEYS.length}`);
    return true;
  }
  return false;
}

// Resilient HTML extractor that never fails on JSON quotes or unescaped strings
function extractCleanHtml(rawText) {
  if (!rawText) return '';

  let text = rawText.trim();

  // 1. If wrapped in ```html ... ``` or ```xml ... ``` or ``` ... ```
  const codeBlockMatch = text.match(/```(?:html|xml)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }

  // 2. If it was returned as JSON (legacy fallback)
  if (text.startsWith('{') && text.includes('"entryHtml"')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.entryHtml) return parsed.entryHtml;
    } catch {
      const regexMatch = text.match(/"entryHtml"\s*:\s*"([\s\S]*?)(?:",|"$|\}\s*$)/);
      if (regexMatch && regexMatch[1]) {
        return regexMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          .replace(/\\t/g, '\t');
      }
    }
  }

  // 3. If standard DOCTYPE or <html> exists in the text
  const docTypeIndex = text.indexOf('<!DOCTYPE html');
  const htmlTagIndex = text.indexOf('<html');
  const startIndex = docTypeIndex !== -1 ? docTypeIndex : htmlTagIndex;

  if (startIndex !== -1) {
    const lastClosing = text.lastIndexOf('</html>');
    if (lastClosing !== -1) {
      return text.slice(startIndex, lastClosing + 7).trim();
    }
    return text.slice(startIndex).trim();
  }

  return text;
}

const SYSTEM_PROMPT = `
You are the World-Class Principal Software Architect and Lead UI/UX Engineer for WEBTO AI — operating at the engineering caliber of Lovable.dev, Bolt.new, and Replit Agent.
You generate fully-formed, production-grade, highly interactive single-page full-stack web applications, marketplaces, platforms, and dashboards (e.g., ZENZO, Zomato, Swiggy, Uber Eats, Amazon, Airbnb, Spotify, Task Managers, Social Feeds, FinTech Analytics).

================================================================
CRITICAL ARCHITECTURE RULES:
================================================================

1. OUTPUT FORMAT:
   - Output ONLY the 100% complete, standalone, production-ready HTML5 document wrapped in a single \`\`\`html codeblock.
   - Do NOT wrap in JSON. Do NOT output markdown explanations outside the codeblock.
   - Under NO circumstances should the HTML be empty, truncated, or a partial stub.

2. CDNs & TYPOGRAPHY:
   - Include Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script>
   - Include Tailwind Config Script enabling custom dark palettes, custom font families, and brand color extensions.
   - Include FontAwesome 6 CDN: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
   - Include Google Fonts CDN (Plus Jakarta Sans, Inter, or Outfit) for clean, high-end typography.
   - Use high-quality, authentic Unsplash image URLs (portraits, products, tech, food, architecture, avatars).

3. MODERN VISUAL DESIGN SYSTEM (LOVABLE AESTHETIC):
   - Backgrounds: Rich dark palettes (#070B14, #0B0B12, #0E1626) or modern light modes (#F8F9FD).
   - Cards: Subtle borders (border border-slate-800/80 or border-white/10), glassmorphism (backdrop-blur-md bg-white/5 or bg-slate-900/60), and rounded corners (rounded-2xl or rounded-3xl).
   - Typography: Clear visual hierarchy with bold headings, muted metadata (#94A3B8), and readable body text.
   - Buttons: Subtle gradients, active click micro-interactions (active:scale-95 transition-transform), and soft focus rings.

4. REACTIVE IN-MEMORY CLIENT DATA STORE (ZERO STATIC DEAD BUTTONS):
   - Every major button, tab, search bar, and modal trigger MUST work with real in-memory JavaScript state (e.g. window.state = { ... }).
   - Never output placeholder comments like "// add logic here" or leave functions empty.
   - Feed & Lists: Real-time search filtering, category pill toggles, and sorting dropdowns.
   - Micro-Interactions: Working like/heart counters (+1 / -1 toggle), bookmarking, and follow/unfollow states.
   - Modals & Drawers: Working open/close transitions for creating posts, viewing details, cart drawers, and bottom sheets.
   - Real-Time Simulation: For messaging or comment sections, sending an item should trigger a simulated incoming response within 1.2 seconds with a typing indicator.
   - Toast System: Trigger brief floating toast notifications on user actions (e.g., "Post published!", "Link copied to clipboard").

5. RESPONSIVE MOBILE-FIRST SHELL:
   - Mobile: Fixed top brand bar, fluid scrollable content feed, and a polished bottom navigation dock (Home, Explore, Create button, Notifications, Profile).
   - Desktop: Side navigation rail or top navbar with clean multi-column layouts.
`;

// Helper: auto-retry with delay on temporary 503 high-demand spikes
async function generateWithRetry(fn, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const is503 = error?.message && (error.message.includes('503') || error.message.includes('high demand') || error.message.includes('UNAVAILABLE'));
      if (is503 && attempt < maxRetries) {
        console.warn(`[AI SERVICE] 503 High demand detected. Retrying in ${(attempt + 1) * 1500}ms...`);
        await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1500));
        continue;
      }
      throw error;
    }
  }
}

export async function generateProjectCode(prompt, projectType = 'FULL_STACK', existingCode = '', image = null, customApiKey = null) {
  let fullPrompt = `${SYSTEM_PROMPT}\n\nProject Architecture Type: ${projectType}\nUser Requirements / App Features:\n${prompt}`;
  if (existingCode) {
    fullPrompt += `\n\nExisting Application Code to update/enhance:\n${existingCode.slice(0, 15000)}`;
  }

  const parts = [{ text: fullPrompt }];

  // If an image (design mockup / wireframe / screenshot) is attached
  if (image) {
    let mimeType = 'image/png';
    let base64Data = image;

    if (image.startsWith('data:')) {
      const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      } else {
        base64Data = image.split(',')[1] || image;
      }
    }

    parts.unshift({
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    });
  }

  const generationConfig = {
    temperature: 0.2,
    maxOutputTokens: 8192,
  };

  // If user supplied their own custom API Key (BYOK), use it directly
  if (customApiKey) {
    console.log('[AI SERVICE] Synthesizing project code using User Custom API Key...');
    const userClient = new GoogleGenAI({ apiKey: customApiKey });
    const response = await generateWithRetry(async () => {
      return await userClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: parts }],
        config: generationConfig
      });
    });

    if (response && response.text) {
      const html = extractCleanHtml(response.text);
      return {
        entryHtml: html,
        files: [{ name: 'index.html', path: '/index.html', content: html }]
      };
    }
  }

  let attempts = 0;
  const maxKeyAttempts = Math.max(1, API_KEYS.length);
  let lastError = null;

  while (attempts < maxKeyAttempts) {
    try {
      const aiClient = getAiClient();
      console.log(`[AI SERVICE] Synthesizing project code (Key #${currentKeyIndex + 1} of ${API_KEYS.length || 1})...`);

      const response = await generateWithRetry(async () => {
        return await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: parts }],
          config: generationConfig
        });
      });

      if (response && response.text) {
        const html = extractCleanHtml(response.text);
        return {
          entryHtml: html,
          files: [{ name: 'index.html', path: '/index.html', content: html }]
        };
      }
    } catch (error) {
      console.warn(`[AI SERVICE WARNING] Key #${currentKeyIndex + 1} failed:`, error.message);
      lastError = error;

      const isQuotaOrRateLimit =
        error.status === 429 ||
        error.message?.includes('429') ||
        error.message?.includes('quota') ||
        error.message?.includes('RESOURCE_EXHAUSTED');

      if (isQuotaOrRateLimit && rotateToNextKey()) {
        attempts++;
        continue;
      }

      throw error;
    }
  }

  console.error('[AI SERVICE ERROR] All available keys exhausted:', lastError);
  throw new Error(lastError?.message || 'Gemini quota exceeded on all configured keys.');
}

export async function generateChatReply(projectName, projectType, messages, customApiKey = null) {
  const formattedHistory = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Lead Architect'}: ${m.content}`)
    .join('\n');

  const prompt = `
You are the Lead Architect for WEBTO AI. You are interviewing the user to plan and design the best web application before coding it.
Project: "${projectName || 'Web App'}" (${projectType || 'FULL_STACK'})

Conversation history so far:
${formattedHistory}

INSTRUCTIONS:
1. Ask 1-2 focused questions about key pages, specific features, style/color theme, or target audience.
2. Keep responses concise (under 3 sentences).
3. At the end of your response, always include 3 concise suggestion chips in this exact format:
   [CHIPS: Option 1 | Option 2 | Option 3]
4. If you have gathered enough details (after 2-3 exchanges), append [READY_TO_BUILD] to your response.
`;

  if (customApiKey) {
    const userClient = new GoogleGenAI({ apiKey: customApiKey });
    const response = await generateWithRetry(async () => {
      return await userClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
    });

    const replyText = response.text || '';
    let chips = [];
    const chipMatch = replyText.match(/\[CHIPS:\s*(.*?)\]/i);
    if (chipMatch) {
      chips = chipMatch[1].split('|').map((c) => c.trim());
    }

    const isReadyToBuild = replyText.includes('[READY_TO_BUILD]');
    const cleanedMessage = replyText
      .replace(/\[CHIPS:\s*.*?\]/i)
      .replace(/\[READY_TO_BUILD\]/i)
      .trim();

    return { message: cleanedMessage, chips, isReadyToBuild };
  }

  let attempts = 0;
  const maxKeyAttempts = Math.max(1, API_KEYS.length);
  let lastError = null;

  while (attempts < maxKeyAttempts) {
    try {
      const aiClient = getAiClient();
      const response = await generateWithRetry(async () => {
        return await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
      });

      const replyText = response.text || '';
      let chips = [];
      const chipMatch = replyText.match(/\[CHIPS:\s*(.*?)\]/i);
      if (chipMatch) {
        chips = chipMatch[1].split('|').map((c) => c.trim());
      }

      const isReadyToBuild = replyText.includes('[READY_TO_BUILD]');
      const cleanedMessage = replyText
        .replace(/\[CHIPS:\s*.*?\]/i)
        .replace(/\[READY_TO_BUILD\]/i)
        .trim();

      return { message: cleanedMessage, chips, isReadyToBuild };
    } catch (err) {
      console.warn(`[AI SERVICE CHAT WARNING] Key #${currentKeyIndex + 1} failed:`, err.message);
      lastError = err;

      const isQuotaOrRateLimit =
        err.status === 429 ||
        err.message?.includes('429') ||
        err.message?.includes('quota') ||
        err.message?.includes('RESOURCE_EXHAUSTED');

      if (isQuotaOrRateLimit && rotateToNextKey()) {
        attempts++;
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}
