import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function cleanAndParseJSON(rawText) {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const sanitized = cleaned.replace(/"((?:\\.|[^"\\])*)"/gs, (match) => {
      return match
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    });
    return JSON.parse(sanitized);
  }
}

const SYSTEM_PROMPT = `
You are the Lead Full-Stack Software Architect and UI/UX Designer for WEBTO AI.
You generate fully-formed, production-grade, highly interactive single-page full-stack web applications, marketplaces, platforms, and dashboards (e.g., Zomato, Swiggy, Uber Eats, Amazon, Airbnb, Spotify, Task Managers, Social Feeds, FinTech Analytics).

CRITICAL ARCHITECTURE RULES:
1. "entryHtml": MUST be a 100% complete, standalone HTML5 document that runs seamlessly out of the box in an iframe sandbox without external build tools.
   - Include Tailwind CSS CDN: <script src="[https://cdn.tailwindcss.com](https://cdn.tailwindcss.com)"></script>
   - Include FontAwesome 6 CDN: <link rel="stylesheet" href="[https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css](https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css)" />
   - Use Google Fonts (Inter or Plus Jakarta Sans) for clean, high-end typography.
   - Use reliable Unsplash image URLs (e.g. food, tech, landscapes, products, avatars).

2. FULL-STACK APPLICATION LOGIC & REAL-TIME STATE:
   - For platforms like Swiggy, Zomato, or Ecommerce:
     * Full interactive Discovery & Feed: Real-time search inputs, category pill filters, sorting dropdowns, veg/non-veg toggles, and rating badges.
     * Full In-Memory State & Store: Implement complete JavaScript state handling (e.g. window.state = { cart: [], user: {}, items: [...], activeFilter: 'all' }) with real-time UI re-rendering functions.
     * Live Cart & Checkout Drawer: Real-time item additions/quantity increments (+/-), subtotal, delivery fee, taxes, discount calculations, and persistent badge counts.
     * Interactive Modals & Drawers: Product/dish detail sheets, filters, order summary modals, and live order tracking simulations (Placed -> Preparing -> Out for Delivery -> Delivered).
     * Forms & Dynamic Views: Add/Edit modals, tab switches, and notification toasts.

3. "files": Provide modular breakdown files (e.g. index.html, app.js, data.json, styles.css) for display in the code viewer.
4. Return valid, parseable JSON conforming strictly to the requested schema.
`;

export async function generateProjectCode(prompt, projectType = 'FULL_STACK', existingCode = '') {
  try {
    console.log('[AI SERVICE] Synthesizing full-stack project code with gemini-3.6-flash...');

    let fullPrompt = `${SYSTEM_PROMPT}\n\nProject Architecture Type: ${projectType}\nUser Requirements / App Features:\n${prompt}`;
    if (existingCode) {
      fullPrompt += `\n\nExisting Application Code to update/enhance:\n${existingCode.slice(0, 15000)}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: fullPrompt }]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            entryHtml: {
              type: Type.STRING,
              description: 'Complete standalone HTML file with Tailwind CSS CDN, FontAwesome, complete mock dataset, and fully functional JavaScript interactive state management.'
            },
            files: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  path: { type: Type.STRING },
                  content: { type: Type.STRING }
                },
                required: ['name', 'path', 'content']
              }
            }
          },
          required: ['entryHtml', 'files']
        }
      }
    });

    return cleanAndParseJSON(response.text);
  } catch (error) {
    console.error('[AI SERVICE ERROR]:', error);
    throw new Error(error.message || 'AI generation failed.');
  }
}

export async function generateChatReply(projectName, projectType, messages) {
  try {
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

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const replyText = response.text || '';
    let chips = [];
    const chipMatch = replyText.match(/\[CHIPS:\s*(.*?)\]/i);
    if (chipMatch) {
      chips = chipMatch[1].split('|').map((c) => c.trim());
    }

    const isReadyToBuild = replyText.includes('[READY_TO_BUILD]');
    const cleanedMessage = replyText
      .replace(/\[CHIPS:\s*.*?\]/i, '')
      .replace(/\[READY_TO_BUILD\]/i, '')
      .trim();

    return { message: cleanedMessage, chips, isReadyToBuild };
  } catch (err) {
    console.error('generateChatReply error:', err);
    throw err;
  }
}