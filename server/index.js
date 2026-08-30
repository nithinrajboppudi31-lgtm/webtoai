import Razorpay from 'razorpay';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { Octokit } from '@octokit/rest';
import { generateProjectCode, generateChatReply } from './services/aiService.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder',
});
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'webto_ai_super_secure_jwt_secret_key_2026';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  process.env.CLIENT_URL,
].filter(Boolean);

// CORS configuration supporting dynamic Vercel preview/production domains
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests, mobile apps, Postman, curl
      if (!origin) return callback(null, true);

      // Allow any vercel.app deployment, localhost ports, or configured CLIENT_URL
      if (
        origin.endsWith('.vercel.app') ||
        allowedOrigins.includes(origin) ||
        origin.startsWith('http://localhost:')
      ) {
        return callback(null, true);
      }

      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Nodemailer SMTP Transporter configured for Render cloud networks
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // TLS via STARTTLS
  family: 4,     // Force IPv4 to bypass ENETUNREACH on Render
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : '',
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

// Verify SMTP connection on server startup
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter.verify((error) => {
    if (error) {
      console.error('❌ Gmail SMTP Verification Failed:', error.message);
    } else {
      console.log('✅ Gmail SMTP Server is ready to send emails');
    }
  });
} else {
  console.warn('⚠️ EMAIL_USER or EMAIL_PASS not set. Emails will be logged to console only.');
}

// Helper to generate an 8-character alphanumeric code
const generate8CharCode = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  const randomBytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
};

// Helper to format clean user object for frontend state
const formatSafeUser = (user) => {
  const { password: _, resetPasswordToken: __, resetPasswordExpires: ___, ...rest } = user;
  const total = rest.freeBuildsTotal ?? 3;
  const used = rest.freeBuildsUsed ?? 0;
  return {
    ...rest,
    credits: Math.max(0, total - used),
  };
};

// Authentication Middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return res.status(401).json({ error: 'User not found or session invalid.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        password: hashedPassword,
        name: name || cleanEmail.split('@')[0],
        freeBuildsUsed: 0,
        freeBuildsTotal: 3,
        role: 'USER',
      },
    });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: formatSafeUser(user) });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanInputPassword = password.trim();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    let isAuthenticated = false;

    // 1. Check permanent password
    const isPasswordMatch = await bcrypt.compare(cleanInputPassword, user.password);
    if (isPasswordMatch) {
      isAuthenticated = true;
    } else if (user.resetPasswordToken && user.resetPasswordExpires) {
      // 2. Check temporary 8-character reset code
      const isNotExpired = new Date() < new Date(user.resetPasswordExpires);
      const isCodeMatch =
        (await bcrypt.compare(cleanInputPassword.toUpperCase(), user.resetPasswordToken)) ||
        (await bcrypt.compare(cleanInputPassword, user.resetPasswordToken));

      if (isNotExpired && isCodeMatch) {
        isAuthenticated = true;

        const tempHashedCode = await bcrypt.hash(cleanInputPassword.toUpperCase(), 10);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            password: tempHashedCode,
            resetPasswordToken: null,
            resetPasswordExpires: null,
          },
        });
      }
    }

    if (!isAuthenticated) {
      return res.status(400).json({ error: 'Invalid email, password, or reset code.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: formatSafeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  return res.json({ user: formatSafeUser(req.user) });
});

// ==================== FORGOT PASSWORD ====================
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Registered email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    const resetCode = generate8CharCode();
    const hashedCode = await bcrypt.hash(resetCode, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: cleanEmail.split('@')[0],
          password: hashedCode,
          resetPasswordToken: hashedCode,
          resetPasswordExpires: expiresAt,
          freeBuildsUsed: 0,
          freeBuildsTotal: 3,
          role: 'USER',
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedCode,
          resetPasswordToken: hashedCode,
          resetPasswordExpires: expiresAt,
        },
      });
    }

    console.log(`\n========================================`);
    console.log(`🔑 TEMPORARY 8-CHAR CODE FOR [${cleanEmail}]: ${resetCode}`);
    console.log(`========================================\n`);

    // Return instant response to UI immediately
    res.json({
      success: true,
      message: `An 8-character temporary code has been sent to ${cleanEmail}.`,
      code: resetCode,
    });

    // Send email in background asynchronously
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      transporter.sendMail(
        {
          from: `"WEBTO AI Security" <${process.env.EMAIL_USER}>`,
          to: cleanEmail,
          subject: 'Your WEBTO AI Temporary Access Code',
          text: `Your temporary access code is: ${resetCode}`,
          html: `
            <div style="background-color: #070b14; color: #ffffff; padding: 32px; font-family: sans-serif; border-radius: 16px; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #60a5fa; margin-bottom: 8px;">WEBTO AI</h2>
              <h3 style="color: #ffffff; margin-top: 0;">Temporary Access Code</h3>
              <p style="color: #94a3b8; font-size: 13px;">Use this 8-character temporary password to sign in to your WEBTO AI account:</p>
              <div style="margin: 24px 0; padding: 16px; background: #0e1626; border: 1px solid #1e293b; border-radius: 12px; text-align: center;">
                <span style="font-family: monospace; font-size: 24px; letter-spacing: 4px; font-weight: bold; color: #38bdf8;">${resetCode}</span>
              </div>
              <p style="color: #64748b; font-size: 12px;">Once signed in, you can update your permanent password anytime under Account Settings.</p>
            </div>
          `,
        },
        (err, info) => {
          if (err) {
            console.error('❌ Background Email Dispatch Error:', err.message);
          } else {
            console.log('✅ Email successfully dispatched:', info.response);
          }
        }
      );
    }
  } catch (err) {
    console.error('Reset code error:', err);
    return res.status(500).json({ error: 'Failed to generate reset code.' });
  }
});

// ==================== CREDITS ROUTE ====================

app.post('/api/credits/refill', authenticate, async (req, res) => {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        freeBuildsUsed: 0,
        freeBuildsTotal: 100,
      },
    });
    return res.json({ message: 'Credits refilled successfully!', user: formatSafeUser(updatedUser) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to refill credits.' });
  }
});

// ==================== PROJECTS CRUD ====================

app.get('/api/projects', authenticate, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      include: { files: true },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json({ projects });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

app.post('/api/projects', authenticate, async (req, res) => {
  try {
    const { name, description, type } = req.body;
    const project = await prisma.project.create({
      data: {
        userId: req.user.id,
        name: name || 'Untitled Web App',
        description: description || '',
        type: type || 'FULL_STACK',
      },
      include: { files: true },
    });
    return res.json({ project });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create project.' });
  }
});

app.get('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
      include: { files: true },
    });
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    return res.json({ project });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch project.' });
  }
});

app.delete('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.project.deleteMany({
      where: { id, userId: req.user.id },
    });
    return res.json({ message: 'Project deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete project.' });
  }
});

// ==================== AI CHAT / DISCOVERY ====================

app.post('/api/chat/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { messages } = req.body;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const chatResult = await generateChatReply(
      project.name,
      project.type,
      messages || []
    );
    return res.json(chatResult);
  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: 'Failed to process chat.' });
  }
});

// ==================== AI GENERATION ====================

app.post('/api/generate/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { prompt } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });

    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
      include: { files: true },
    });

    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const totalBuilds = req.user.freeBuildsTotal ?? 3;
    const usedBuilds = req.user.freeBuildsUsed ?? 0;
    if (usedBuilds >= totalBuilds) {
      return res.status(403).json({ error: 'No build credits remaining. Please upgrade your plan.' });
    }

    const existingIndex = project.files?.find((f) => f.name === 'index.html');
    const existingCode = existingIndex?.content || project.entryHtml || '';

    const generatedData = await generateProjectCode(prompt, project.type, existingCode);

    if (!generatedData || !generatedData.entryHtml) {
      return res.status(500).json({ error: 'Invalid response from AI engine.' });
    }

    let filesToSave = generatedData.files || [];
    const hasIndex = filesToSave.some((f) => f.name === 'index.html');
    if (!hasIndex) {
      filesToSave.unshift({
        name: 'index.html',
        path: '/index.html',
        content: generatedData.entryHtml,
      });
    }

    await prisma.projectFile.deleteMany({ where: { projectId: id } });

    for (const file of filesToSave) {
      await prisma.projectFile.create({
        data: {
          projectId: id,
          name: file.name,
          content: file.name === 'index.html' ? generatedData.entryHtml : file.content,
          path: file.path || `/${file.name}`,
        },
      });
    }

    await prisma.projectVersion.create({
      data: {
        projectId: id,
        prompt: prompt.slice(0, 500),
        entryHtml: generatedData.entryHtml,
      },
    });

    await prisma.project.update({
      where: { id },
      data: { entryHtml: generatedData.entryHtml },
    });

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { freeBuildsUsed: { increment: 1 } },
    });

    return res.json({
      success: true,
      entryHtml: generatedData.entryHtml,
      files: filesToSave,
      remainingCredits: Math.max(0, updatedUser.freeBuildsTotal - updatedUser.freeBuildsUsed),
    });
  } catch (err) {
    console.error('Generation error:', err);
    return res.status(500).json({ error: err.message || 'AI generation failed.' });
  }
});

// ==================== HISTORY & ROLLBACK ====================

app.get('/api/projects/:id/history', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const versions = await prisma.projectVersion.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ versions });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

app.post('/api/projects/:id/rollback/:versionId', authenticate, async (req, res) => {
  try {
    const { id, versionId } = req.params;
    const version = await prisma.projectVersion.findFirst({
      where: { id: versionId, projectId: id },
    });

    if (!version) return res.status(404).json({ error: 'Version not found.' });

    await prisma.projectFile.deleteMany({
      where: { projectId: id, name: 'index.html' },
    });

    await prisma.projectFile.create({
      data: {
        projectId: id,
        name: 'index.html',
        path: '/index.html',
        content: version.entryHtml,
      },
    });

    await prisma.project.update({
      where: { id },
      data: { entryHtml: version.entryHtml },
    });

    return res.json({
      message: 'Rolled back to version successfully!',
      entryHtml: version.entryHtml,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to rollback.' });
  }
});

// ==================== DEPLOYMENT ROUTES ====================

app.post('/api/deploy/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
      include: { files: true },
    });

    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const indexFile = project.files.find((f) => f.name === 'index.html');
    const contentToDeploy = indexFile?.content || project.entryHtml;

    if (!contentToDeploy) {
      return res.status(400).json({ error: 'Generate code first before deploying.' });
    }

    const baseTitle = (project.name || 'app')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 20);
    const shortId = project.id.slice(0, 6);
    let liveUrl = `https://webtoai-backend.onrender.com/live/${baseTitle}-${shortId}`;
    const liveSlug = `${baseTitle}-${shortId}`;

    if (process.env.VERCEL_AUTH_TOKEN) {
      try {
        const vercelFiles = project.files.map((file) => ({
          file: file.path.startsWith('/') ? file.path.slice(1) : file.path,
          data: Buffer.from(file.content, 'utf-8').toString('base64'),
          encoding: 'base64',
        }));

        if (!vercelFiles.some((f) => f.file === 'index.html')) {
          vercelFiles.push({
            file: 'index.html',
            data: Buffer.from(contentToDeploy, 'utf-8').toString('base64'),
            encoding: 'base64',
          });
        }

        const vercelRes = await fetch('https://api.vercel.com/v13/deployments', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.VERCEL_AUTH_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: baseTitle,
            files: vercelFiles,
            projectSettings: { framework: null },
          }),
        });

        const vercelData = await vercelRes.json();
        if (vercelRes.ok && vercelData.url) {
          liveUrl = `https://${vercelData.url}`;
        }
      } catch (cloudErr) {
        console.warn('Cloud deployment failed, fallback to local:', cloudErr.message);
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        isDeployed: true,
        deployedUrl: liveUrl,
        slug: liveSlug,
      },
    });

    await prisma.deployment.upsert({
      where: { slug: liveSlug },
      update: { deployedUrl: liveUrl },
      create: {
        projectId: id,
        slug: liveSlug,
        deployedUrl: liveUrl,
      },
    });

    return res.json({
      message: 'Project deployed successfully!',
      deployedUrl: liveUrl,
      project: updatedProject,
    });
  } catch (err) {
    console.error('Deployment error:', err);
    return res.status(500).json({ error: 'Failed to deploy project.' });
  }
});

app.get('/api/deployments', authenticate, async (req, res) => {
  try {
    const deployedProjects = await prisma.project.findMany({
      where: {
        userId: req.user.id,
        isDeployed: true,
      },
      include: { files: true },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json({ deployments: deployedProjects });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch deployments.' });
  }
});

app.delete('/api/deploy/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.project.updateMany({
      where: { id, userId: req.user.id },
      data: {
        isDeployed: false,
        deployedUrl: null,
      },
    });
    return res.json({ message: 'Project unpublished successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to unpublish deployment.' });
  }
});

app.get('/live/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const shortId = slug.split('-').pop();

    const project = await prisma.project.findFirst({
      where: { id: { startsWith: shortId } },
      include: { files: true },
    });

    const indexFile = project?.files?.find((f) => f.name === 'index.html');
    const content = indexFile?.content || project?.entryHtml;

    if (!project || !content) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <script src="https://cdn.tailwindcss.com"></script>
          <title>404 - Not Found</title>
        </head>
        <body class="bg-slate-950 text-white min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <h1 class="text-6xl font-black text-blue-500 mb-4">404</h1>
          <h2 class="text-2xl font-bold mb-2">Deployment Not Found</h2>
          <p class="text-slate-400 max-w-md mb-6">The requested site does not exist or has not been generated yet.</p>
          <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" class="px-5 py-2.5 bg-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-500">Go to WEBTO AI</a>
        </body>
        </html>
      `);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(content);
  } catch (err) {
    return res.status(500).send('Internal server error.');
  }
});

// ==================== SETTINGS & PROFILE ROUTES ====================

app.put('/api/user/profile', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { name: name || req.user.name },
    });
    return res.json({ message: 'Profile updated successfully!', user: formatSafeUser(updatedUser) });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

const handlePasswordChange = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new passwords are required.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, req.user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password does not match.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    return res.json({ message: 'Password changed successfully!' });
  } catch (err) {
    console.error('Password change error:', err);
    return res.status(500).json({ error: 'Failed to update password.' });
  }
};

app.put('/api/user/password', authenticate, handlePasswordChange);
app.post('/api/user/change-password', authenticate, handlePasswordChange);

// ==================== TEMPLATES CATALOG ====================

const TEMPLATES_DATA = [
  {
    id: 'saas-landing',
    name: 'SaaS Platform Landing Page',
    category: 'Landing Page',
    description: 'Modern high-converting hero, interactive pricing cards, and feature grid.',
    type: 'LANDING_PAGE',
    entryHtml: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Apex SaaS Platform</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans">
  <header class="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
    <div class="flex items-center gap-2 font-bold text-lg text-white">
      <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white"><i class="fa-solid fa-bolt"></i></div>
      Apex SaaS
    </div>
    <div class="flex items-center gap-3">
      <button class="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white">Sign In</button>
      <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold">Get Started Free</button>
    </div>
  </header>
  <main class="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-4xl mx-auto space-y-6">
    <span class="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-semibold">✨ Powered by Generative Intelligence</span>
    <h1 class="text-4xl sm:text-6xl font-black tracking-tight text-white">Build production apps at 10x developer velocity</h1>
    <p class="text-slate-400 text-sm sm:text-base max-w-xl">Supercharge your workflows with modular AI architectures, instantaneous sandboxes, and continuous zero-config deployments.</p>
    <div class="flex flex-wrap gap-4 justify-center">
      <button class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25">Start Building Now</button>
      <button class="px-6 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold">Explore Live Demo</button>
    </div>
  </main>
</body>
</html>`,
  },
  {
    id: 'fintech-dashboard',
    name: 'Fintech & Analytics Hub',
    category: 'Dashboard',
    description: 'Dark-mode financial metrics, live transaction logs, and revenue charts.',
    type: 'FULL_STACK',
    entryHtml: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vortex Capital Analytics</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex font-sans">
  <aside class="w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between">
    <div class="space-y-6">
      <div class="flex items-center gap-2 text-lg font-bold text-white"><i class="fa-solid fa-chart-line text-emerald-400"></i> Vortex Capital</div>
      <nav class="space-y-2 text-xs">
        <a href="#" class="block px-3 py-2 bg-blue-600/20 text-blue-400 rounded-lg font-semibold">Overview</a>
        <a href="#" class="block px-3 py-2 text-slate-400 hover:text-white rounded-lg">Transactions</a>
        <a href="#" class="block px-3 py-2 text-slate-400 hover:text-white rounded-lg">Wallets</a>
      </nav>
    </div>
    <div class="p-3 bg-slate-950 rounded-xl text-xs text-slate-400">Status: <span class="text-emerald-400 font-semibold">Operational</span></div>
  </aside>
  <main class="flex-1 p-8 overflow-y-auto space-y-6">
    <h2 class="text-2xl font-bold text-white">Financial Performance</h2>
    <div class="grid grid-cols-3 gap-6">
      <div class="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
        <p class="text-xs text-slate-400">Net Balance</p>
        <p class="text-3xl font-black text-white mt-1">₹4,28,490</p>
        <span class="text-xs text-emerald-400 mt-2 block">+14.2% this month</span>
      </div>
      <div class="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
        <p class="text-xs text-slate-400">Active Subscriptions</p>
        <p class="text-3xl font-black text-white mt-1">1,842</p>
        <span class="text-xs text-blue-400 mt-2 block">+82 new users</span>
      </div>
      <div class="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
        <p class="text-xs text-slate-400">Processing Success</p>
        <p class="text-3xl font-black text-white mt-1">99.8%</p>
        <span class="text-xs text-slate-400 mt-2 block">Zero failures today</span>
      </div>
    </div>
  </main>
</body>
</html>`,
  },
  {
    id: 'portfolio-showcase',
    name: 'Developer Portfolio & Showcase',
    category: 'Portfolio',
    description: 'Clean showcase with project spotlight cards, skill tags, and contact forms.',
    type: 'PORTFOLIO',
    entryHtml: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Developer Portfolio</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen p-8 max-w-4xl mx-auto font-sans space-y-12">
  <section class="flex flex-col sm:flex-row items-center gap-6 pt-8">
    <div class="w-24 h-24 rounded-2xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center text-3xl font-black text-white shadow-xl">NR</div>
    <div>
      <h1 class="text-3xl font-bold text-white">Full-Stack Architect & Engineer</h1>
      <p class="text-slate-400 text-sm mt-1">Building high-performance distributed systems, AI integrations, and responsive interfaces.</p>
    </div>
  </section>
  <section class="space-y-4">
    <h2 class="text-lg font-bold text-white flex items-center gap-2"><i class="fa-solid fa-code text-blue-400"></i> Featured Works</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
        <h3 class="font-bold text-white">Cloud Orchestrator</h3>
        <p class="text-xs text-slate-400">Automated multi-node load balancing infrastructure dashboard.</p>
      </div>
      <div class="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
        <h3 class="font-bold text-white">Generative Code Assistant</h3>
        <p class="text-xs text-slate-400">Autonomous context-aware web app developer powered by Gemini.</p>
      </div>
    </div>
  </section>
</body>
</html>`,
  },
];

app.get('/api/templates', (req, res) => {
  return res.json({ templates: TEMPLATES_DATA });
});

const handleUseTemplate = async (req, res) => {
  try {
    const templateId = req.params.templateId || req.body?.templateId || req.body?.id;
    const template = TEMPLATES_DATA.find((t) => t.id === templateId) || TEMPLATES_DATA[0];

    const project = await prisma.project.create({
      data: {
        userId: req.user.id,
        name: req.body?.title || template.name,
        description: template.description,
        type: template.type,
        entryHtml: template.entryHtml,
        files: {
          create: [
            {
              name: 'index.html',
              path: '/index.html',
              content: template.entryHtml,
            },
          ],
        },
      },
    });

    return res.json({
      message: 'Template cloned successfully!',
      projectId: project.id,
      project,
    });
  } catch (err) {
    console.error('Template clone error:', err);
    return res.status(500).json({ error: 'Failed to create project from template.' });
  }
};

app.post('/api/templates/:templateId/use', authenticate, handleUseTemplate);
app.post('/api/projects/create-from-template', authenticate, handleUseTemplate);

// ==================== ADMIN CREDIT DISPATCH ROUTES ====================

app.post('/api/admin/credits/global', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const { amount = 10 } = req.body;

    const result = await prisma.user.updateMany({
      data: {
        freeBuildsTotal: { increment: Number(amount) },
      },
    });

    return res.json({
      message: `Successfully added ${amount} build credits to all ${result.count} users!`,
      affectedUsers: result.count,
    });
  } catch (err) {
    console.error('Global grant error:', err);
    return res.status(500).json({ error: 'Failed to distribute global credits.' });
  }
});

app.post('/api/admin/credits/user', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const { email, amount = 10 } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!targetUser) {
      return res.status(404).json({ error: `User with email "${email}" not found.` });
    }

    const updatedUser = await prisma.user.update({
      where: { email: email.trim().toLowerCase() },
      data: {
        freeBuildsTotal: { increment: Number(amount) },
      },
    });

    return res.json({
      message: `Successfully added ${amount} build credits to ${targetUser.email}!`,
      user: formatSafeUser(updatedUser),
    });
  } catch (err) {
    console.error('Individual grant error:', err);
    return res.status(500).json({ error: 'Failed to grant user credits.' });
  }
});

// ==================== RAZORPAY PAYMENT ROUTES ====================

const PACKAGES = {
  starter: { name: 'Starter Plan', credits: 100, priceInInr: 99 },
  builder: { name: 'Builder Plan', credits: 500, priceInInr: 399 },
  pro: { name: 'Pro Plan', credits: 1500, priceInInr: 999 },
};

app.get('/api/payments/packages', (req, res) => {
  return res.json({ packages: PACKAGES });
});

app.post('/api/payments/create-order', authenticate, async (req, res) => {
  try {
    const { planKey } = req.body;
    const selectedPlan = PACKAGES[planKey];

    if (!selectedPlan) {
      return res.status(400).json({ error: 'Invalid credit package selected.' });
    }

    const options = {
      amount: selectedPlan.priceInInr * 100,
      currency: 'INR',
      receipt: `rcpt_${req.user.id.slice(0, 6)}_${Date.now().toString().slice(-6)}`,
      notes: {
        userId: req.user.id,
        planKey,
        credits: selectedPlan.credits,
      },
    };

    const order = await razorpay.orders.create(options);

    await prisma.payment.create({
      data: {
        userId: req.user.id,
        razorpayOrderId: order.id,
        amount: selectedPlan.priceInInr,
        status: 'PENDING',
        creditsGranted: selectedPlan.credits,
      },
    });

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan: selectedPlan,
    });
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ error: 'Failed to create payment order.' });
  }
});

app.post('/api/payments/verify', authenticate, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planKey,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification parameters missing.' });
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      await prisma.payment.updateMany({
        where: { razorpayOrderId: razorpay_order_id },
        data: { status: 'FAILED' },
      });
      return res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
    }

    const existingPayment = await prisma.payment.findFirst({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (existingPayment && existingPayment.status === 'SUCCESS') {
      return res.status(400).json({ error: 'Payment has already been processed.' });
    }

    const selectedPlan = PACKAGES[planKey] || { name: 'Starter Plan', credits: 100 };

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        freeBuildsTotal: { increment: selectedPlan.credits },
      },
    });

    await prisma.payment.updateMany({
      where: { razorpayOrderId: razorpay_order_id },
      data: {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'SUCCESS',
      },
    });

    await prisma.creditTransaction.create({
      data: {
        userId: req.user.id,
        type: 'PURCHASE',
        amount: selectedPlan.credits,
        balanceAfter: updatedUser.freeBuildsTotal - updatedUser.freeBuildsUsed,
        description: `Purchased ${selectedPlan.name} (${selectedPlan.credits} Builds)`,
      },
    });

    return res.json({
      success: true,
      message: `Payment verified! Added ${selectedPlan.credits} builds to your account.`,
      user: formatSafeUser(updatedUser),
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    return res.status(500).json({ error: 'Failed to verify payment.' });
  }
});

app.get('/api/payments/transactions', authenticate, async (req, res) => {
  try {
    const transactions = await prisma.creditTransaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ transactions });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
});

// POST /api/github/push/:id - Create repository & upload files
app.post('/api/github/push/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { githubToken, repoName, isPrivate } = req.body;

    if (!githubToken || !repoName) {
      return res.status(400).json({ error: 'GitHub Token and Repository Name are required.' });
    }

    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
      include: { files: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const octokit = new Octokit({ auth: githubToken });

    const createRepoRes = await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName.trim().toLowerCase().replace(/\s+/g, '-'),
      description: project.description || `Created with WEBTO AI - ${project.name}`,
      private: !!isPrivate,
      auto_init: true,
    });

    const owner = createRepoRes.data.owner.login;
    const repo = createRepoRes.data.name;

    const filesToPush = [];

    if (project.files && project.files.length > 0) {
      project.files.forEach((f) => {
        const filePath = f.path?.startsWith('/') ? f.path.slice(1) : f.name;
        filesToPush.push({ path: filePath, content: f.content || '' });
      });
    } else if (project.entryHtml) {
      filesToPush.push({ path: 'index.html', content: project.entryHtml });
    }

    const packageJsonContent = JSON.stringify(
      {
        name: repo,
        version: '1.0.0',
        private: true,
        scripts: { start: 'serve .' },
      },
      null,
      2
    );
    filesToPush.push({ path: 'package.json', content: packageJsonContent });

    for (const file of filesToPush) {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: file.path,
        message: `Add ${file.path} via WEBTO AI`,
        content: Buffer.from(file.content).toString('base64'),
      });
    }

    return res.json({
      success: true,
      repoUrl: createRepoRes.data.html_url,
      repoFullName: createRepoRes.data.full_name,
    });
  } catch (err) {
    console.error('GitHub Push Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to push repository to GitHub' });
  }
});

// ==================== COMMUNITY EXPLORE & FORK ====================

app.get('/api/explore', async (req, res) => {
  try {
    const publicProjects = await prisma.project.findMany({
      where: { isPublic: true },
      include: {
        user: { select: { id: true, name: true } },
        files: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json({ projects: publicProjects });
  } catch (err) {
    console.error('Explore fetch error:', err);
    return res.status(500).json({ error: 'Failed to load community projects.' });
  }
});

app.patch('/api/projects/:id/visibility', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublic } = req.body;

    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const updated = await prisma.project.update({
      where: { id },
      data: { isPublic: !!isPublic },
    });

    return res.json({ success: true, isPublic: updated.isPublic });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update project visibility.' });
  }
});

app.post('/api/projects/:id/fork', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const sourceProject = await prisma.project.findUnique({
      where: { id },
      include: { files: true },
    });

    if (!sourceProject) {
      return res.status(404).json({ error: 'Source project not found.' });
    }

    const forkedProject = await prisma.project.create({
      data: {
        userId: req.user.id,
        name: `${sourceProject.name} (Fork)`,
        description: sourceProject.description,
        type: sourceProject.type,
        entryHtml: sourceProject.entryHtml,
        forkedFromId: sourceProject.id,
        isPublic: false,
      },
    });

    if (sourceProject.files && sourceProject.files.length > 0) {
      for (const file of sourceProject.files) {
        await prisma.projectFile.create({
          data: {
            projectId: forkedProject.id,
            name: file.name,
            path: file.path,
            content: file.content,
          },
        });
      }
    } else if (sourceProject.entryHtml) {
      await prisma.projectFile.create({
        data: {
          projectId: forkedProject.id,
          name: 'index.html',
          path: '/index.html',
          content: sourceProject.entryHtml,
        },
      });
    }

    return res.json({
      success: true,
      message: 'Project forked successfully!',
      projectId: forkedProject.id,
    });
  } catch (err) {
    console.error('Fork error:', err);
    return res.status(500).json({ error: 'Failed to fork project.' });
  }
});

// ==================== SEO & CUSTOM SLUG ====================

app.patch('/api/projects/:id/seo', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { slug, title, description } = req.body;

    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
      include: { files: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    let cleanSlug = project.slug;
    if (slug && slug !== project.slug) {
      cleanSlug = slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 40);

      const existingSlug = await prisma.project.findFirst({
        where: { slug: cleanSlug, NOT: { id } },
      });

      if (existingSlug) {
        return res.status(400).json({ error: 'This slug URL is already taken. Please choose another.' });
      }
    }

    let updatedEntryHtml = project.entryHtml;
    if (updatedEntryHtml && (title || description)) {
      if (title) {
        if (updatedEntryHtml.includes('<title>')) {
          updatedEntryHtml = updatedEntryHtml.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
        } else if (updatedEntryHtml.includes('<head>')) {
          updatedEntryHtml = updatedEntryHtml.replace('<head>', `<head>\n  <title>${title}</title>`);
        }
      }
      if (description) {
        const metaDesc = `<meta name="description" content="${description}">`;
        if (updatedEntryHtml.includes('<meta name="description"')) {
          updatedEntryHtml = updatedEntryHtml.replace(/<meta name="description".*?>/i, metaDesc);
        } else if (updatedEntryHtml.includes('<head>')) {
          updatedEntryHtml = updatedEntryHtml.replace('<head>', `<head>\n  ${metaDesc}`);
        }
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        name: title || project.name,
        description: description || project.description,
        slug: cleanSlug,
        entryHtml: updatedEntryHtml,
        deployedUrl: project.isDeployed ? `https://webtoai-backend.onrender.com/live/${cleanSlug}` : project.deployedUrl,
      },
    });

    if (updatedEntryHtml) {
      await prisma.projectFile.updateMany({
        where: { projectId: id, name: 'index.html' },
        data: { content: updatedEntryHtml },
      });
    }

    return res.json({
      success: true,
      message: 'SEO settings and live slug updated!',
      project: updatedProject,
      entryHtml: updatedEntryHtml,
    });
  } catch (err) {
    console.error('SEO update error:', err);
    return res.status(500).json({ error: 'Failed to update SEO settings.' });
  }
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`WEBTO AI Backend running on http://localhost:${PORT}`);
});