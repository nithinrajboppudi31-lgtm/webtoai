  import Razorpay from 'razorpay';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
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
      if (!origin) return callback(null, true);
      if (
        origin.endsWith('.vercel.app') ||
        allowedOrigins.includes(origin) ||
        origin.startsWith('http://localhost:')
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Allow all for development & testing
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Expanded body payload parsing for high-res photo uploads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// ============================================================
// RESEND EMAIL SERVICE
// ============================================================

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

if (resend) {
  console.log('✅ Resend email service configured');
} else {
  console.warn('⚠️ RESEND_API_KEY not set. Emails will not be sent.');
}

// In-memory OTP storage for Admin login
let activeAdminOtp = null;
let adminOtpExpiresAt = null;

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
  const {
    password: _,
    resetPasswordToken: __,
    resetPasswordExpires: ___,
    ...rest
  } = user;

  const total = rest.freeBuildsTotal ?? 3;
  const used = rest.freeBuildsUsed ?? 0;

  return {
    ...rest,
    credits: Math.max(0, total - used),
  };
};

// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // If admin token
    if (decoded.role === 'ADMIN') {
      req.user = { id: 'admin', email: decoded.email, role: 'ADMIN' };
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found or session invalid.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// ============================================================
// ADMIN OTP AUTHENTICATION ROUTES
// ============================================================

app.post('/api/admin/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || 'webtoai26@gmail.com';

    if (!email || email.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
      return res.status(403).json({ error: 'Unauthorized: Not a registered admin email.' });
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    activeAdminOtp = generatedOtp;
    adminOtpExpiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

    console.log('------------------------------------');
    console.log(`>>> WEBTO ADMIN OTP: ${generatedOtp} <<<`);
    console.log('------------------------------------');

    if (resend) {
      try {
        const sendResult = await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: [adminEmail.trim().toLowerCase()],
          subject: 'WEBTO AI Admin Login Code',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #0f172a; color: #ffffff; border-radius: 12px; max-width: 450px; margin: 0 auto;">
              <h2 style="color: #38bdf8; margin-top: 0;">WEBTO AI Admin Verification</h2>
              <p style="color: #cbd5e1; font-size: 14px;">Use the following one-time security code to access the Admin Panel:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8; margin: 24px 0; text-align: center; background: #1e293b; padding: 14px; border-radius: 8px;">
                ${generatedOtp}
              </div>
              <p style="color: #94a3b8; font-size: 12px;">This code expires in 10 minutes. If you did not initiate this login, you can safely ignore this email.</p>
            </div>
          `,
        });
        console.log('✅ Resend Dispatch Success:', JSON.stringify(sendResult));
      } catch (emailErr) {
        console.error('❌ Resend Dispatch Error:', emailErr);
      }
    } else {
      console.warn('⚠️ RESEND_API_KEY missing. OTP printed to terminal logs only.');
    }

    return res.json({ success: true, message: 'Security code sent to admin email.' });
  } catch (error) {
    console.error('Error sending admin OTP:', error);
    return res.status(500).json({ error: error.message || 'Failed to send OTP.' });
  }
});

app.post('/api/admin/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || 'webtoai26@gmail.com';

    if (!email || email.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    if (!activeAdminOtp || !adminOtpExpiresAt || Date.now() > adminOtpExpiresAt) {
      return res.status(400).json({ error: 'Security code has expired. Please request a new one.' });
    }

    if (otp.trim() !== activeAdminOtp.trim()) {
      return res.status(400).json({ error: 'Invalid security code.' });
    }

    activeAdminOtp = null;
    adminOtpExpiresAt = null;

    const token = jwt.sign(
      { role: 'ADMIN', email: adminEmail },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ success: true, token });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({ error: 'Verification failed.' });
  }
});

// Admin Dashboard Overview Stats & Users
app.get('/api/admin/overview', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const [totalUsers, totalProjects, users, payments] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.payment.findMany({
        where: { status: 'SUCCESS' },
      }),
    ]);

    const totalRevenue = payments.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return res.json({
      totalUsers,
      totalProjects,
      totalRevenue,
      users: users.map(formatSafeUser),
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    return res.status(500).json({ error: 'Failed to fetch admin overview.' });
  }
});

// Admin Payments Ledger Query
app.get('/api/admin/payments', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.json({ payments });
  } catch (error) {
    console.error('Error fetching admin payments:', error);
    return res.status(500).json({ error: 'Failed to fetch transaction records.' });
  }
});

// Admin Update Pricing Packages Directly
app.post('/api/admin/packages/update', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { starterPrice, starterCredits, builderPrice, builderCredits, proPrice, proCredits } = req.body;

    if (starterPrice) PACKAGES.starter.priceInInr = Number(starterPrice);
    if (starterCredits) PACKAGES.starter.credits = Number(starterCredits);
    if (builderPrice) PACKAGES.builder.priceInInr = Number(builderPrice);
    if (builderCredits) PACKAGES.builder.credits = Number(builderCredits);
    if (proPrice) PACKAGES.pro.priceInInr = Number(proPrice);
    if (proCredits) PACKAGES.pro.credits = Number(proCredits);

    return res.json({
      success: true,
      message: 'Pricing packages updated successfully!',
      packages: PACKAGES,
    });
  } catch (error) {
    console.error('Error updating packages:', error);
    return res.status(500).json({ error: 'Failed to update pricing packages.' });
  }
});

// ============================================================
// AUTH ROUTES (Passwordless Email & OAuth Upsert)
// ============================================================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      const dummyPass = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          password: dummyPass,
          name: name || cleanEmail.split('@')[0],
          freeBuildsUsed: 0,
          freeBuildsTotal: 3,
          role: 'USER',
        },
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: formatSafeUser(user) });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      const dummyPass = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          password: dummyPass,
          name: cleanEmail.split('@')[0],
          freeBuildsUsed: 0,
          freeBuildsTotal: 3,
          role: 'USER',
        },
      });
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

// ============================================================
// GOOGLE & GITHUB OAUTH ROUTES
// ============================================================

// Unified Direct OAuth Authentication (Google & GitHub)
app.post('/api/auth/oauth', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required for authentication.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      const dummyPass = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: name || cleanEmail.split('@')[0],
          password: dummyPass,
          freeBuildsUsed: 0,
          freeBuildsTotal: 3,
          role: 'USER',
        },
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({ token, user: formatSafeUser(user) });
  } catch (error) {
    console.error('OAuth direct authentication error:', error);
    return res.status(500).json({ error: 'OAuth authentication failed.' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) return res.status(400).json({ error: 'Access token is required' });

    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!googleRes.ok) return res.status(401).json({ error: 'Failed to verify Google account' });

    const profile = await googleRes.json();
    const cleanEmail = profile.email.trim().toLowerCase();

    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      const dummyPass = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: profile.name || cleanEmail.split('@')[0],
          password: dummyPass,
          freeBuildsUsed: 0,
          freeBuildsTotal: 3,
          role: 'USER',
        },
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({ token, user: formatSafeUser(user) });
  } catch (error) {
    console.error('Google authentication failed:', error);
    return res.status(500).json({ error: 'Google authentication failed' });
  }
});

app.post('/api/auth/github', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Authorization code is required' });

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      return res.status(401).json({ error: 'Failed to exchange GitHub authorization token' });
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await userRes.json();

    let email = profile.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const emails = await emailRes.json();
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary ? primary.email : `${profile.login}@users.noreply.github.com`;
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      const dummyPass = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: profile.name || profile.login || cleanEmail.split('@')[0],
          password: dummyPass,
          freeBuildsUsed: 0,
          freeBuildsTotal: 3,
          role: 'USER',
        },
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({ token, user: formatSafeUser(user) });
  } catch (error) {
    console.error('GitHub authentication failed:', error);
    return res.status(500).json({ error: 'GitHub authentication failed' });
  }
});

// ============================================================
// WORKSPACE & ACCOUNT SHARING ROUTE
// ============================================================

app.post('/api/share/invite', authenticate, async (req, res) => {
  try {
    const { targetEmail } = req.body;
    if (!targetEmail) {
      return res.status(400).json({ error: 'Target user email is required' });
    }

    const cleanTargetEmail = targetEmail.trim().toLowerCase();
    const shareToken = crypto.randomBytes(16).toString('hex');
    const clientUrl = process.env.CLIENT_URL || 'https://webtoai.vercel.app';
    const shareUrl = `${clientUrl}/?shared_by=${encodeURIComponent(req.user.email)}&invite_token=${shareToken}`;

    return res.json({
      success: true,
      message: `Workspace invite generated for ${cleanTargetEmail}!`,
      shareUrl,
    });
  } catch (error) {
    console.error('Share invite error:', error);
    return res.status(500).json({ error: 'Failed to create share invite.' });
  }
});

// ============================================================
// CREDITS & TRANSACTIONS ROUTE
// ============================================================

app.post('/api/credits/refill', authenticate, async (req, res) => {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        freeBuildsUsed: 0,
        freeBuildsTotal: 100,
      },
    });

    return res.json({
      message: 'Credits refilled successfully!',
      user: formatSafeUser(updatedUser),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to refill credits.' });
  }
});

app.get('/api/payments/transactions', authenticate, async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const userCredits = Math.max(0, (req.user.freeBuildsTotal ?? 3) - (req.user.freeBuildsUsed ?? 0));

    const formattedTransactions = payments.map((p) => ({
      id: p.id,
      description: `Purchased ${p.planKey || 'Credits Package'}`,
      amount: p.amount || 0,
      balanceAfter: userCredits,
      createdAt: p.createdAt,
    }));

    return res.json({ transactions: formattedTransactions });
  } catch (err) {
    console.error('Error fetching user transactions:', err);
    return res.status(500).json({ error: 'Failed to load transaction records.' });
  }
});

// ============================================================
// PROJECTS CRUD & SEO / VISIBILITY
// ============================================================

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

// Toggle Project Visibility (Public/Private)
app.patch('/api/projects/:id/visibility', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublic } = req.body;

    const updated = await prisma.project.updateMany({
      where: { id, userId: req.user.id },
      data: { isPublic: !!isPublic },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    return res.json({ success: true, isPublic: !!isPublic });
  } catch (err) {
    console.error('Project visibility update error:', err);
    return res.status(500).json({ error: 'Failed to update visibility.' });
  }
});

// Update Project SEO & Vanity Slug
app.patch('/api/projects/:id/seo', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, description } = req.body;

    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
      include: { files: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        name: title || project.name,
        slug: slug || project.slug,
        description: description !== undefined ? description : project.description,
      },
      include: { files: true },
    });

    return res.json({
      success: true,
      project: updatedProject,
      entryHtml: updatedProject.entryHtml,
    });
  } catch (err) {
    console.error('SEO update error:', err);
    return res.status(500).json({ error: 'Failed to update SEO settings.' });
  }
});

// ============================================================
// AI CHAT & GENERATION (Multimodal Image Support)
// ============================================================

app.post('/api/chat/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { messages } = req.body;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const chatResult = await generateChatReply(project.name, project.type, messages || []);
    return res.json(chatResult);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to process chat.' });
  }
});

app.post('/api/generate/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { prompt, image } = req.body;

    if (!prompt && !image) return res.status(400).json({ error: 'Prompt or image is required.' });

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

    // Pass image into generateProjectCode
    const generatedData = await generateProjectCode(
      prompt || 'Recreate and build modern responsive web UI matching this design photo',
      project.type,
      existingCode,
      image
    );

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
        prompt: (prompt || 'UI Generated from Photo').slice(0, 500),
        entryHtml: generatedData.entryHtml,
      },
    });

    await prisma.project.update({
      where: { id },
      data: { entryHtml: generatedData.entryHtml },
    });

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        freeBuildsUsed: { increment: 1 },
      },
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

// ============================================================
// HISTORY & ROLLBACK
// ============================================================

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
      where: { id, versionId, projectId: id },
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

// ============================================================
// DEPLOYMENT ROUTES
// ============================================================

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

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        isDeployed: true,
        deployedUrl: liveUrl,
        slug: liveSlug,
      },
    });

    return res.json({
      message: 'Project deployed successfully!',
      deployedUrl: liveUrl,
      project: updatedProject,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to deploy project.' });
  }
});

app.get('/api/deployments', authenticate, async (req, res) => {
  try {
    const deployedProjects = await prisma.project.findMany({
      where: { userId: req.user.id, isDeployed: true },
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
      data: { isDeployed: false, deployedUrl: null },
    });
    return res.json({ message: 'Project unpublished successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to unpublish project.' });
  }
});

app.get('/live/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const shortId = slug.split('-').pop();

    const project = await prisma.project.findFirst({
      where: {
        OR: [{ slug }, { id: { startsWith: shortId } }],
      },
      include: { files: true },
    });

    const indexFile = project?.files?.find((f) => f.name === 'index.html');
    const content = indexFile?.content || project?.entryHtml;

    if (!project || !content) {
      return res.status(404).send('<h2>404 - Deployment Not Found</h2>');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(content);
  } catch (err) {
    return res.status(500).send('Internal server error.');
  }
});

// ============================================================
// SETTINGS & PROFILE ROUTES
// ============================================================

app.put('/api/user/profile', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { name: name || req.user.name },
    });
    return res.json({
      message: 'Profile updated successfully!',
      user: formatSafeUser(updatedUser),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ============================================================
// ADMIN CREDIT DISPATCH ROUTES
// ============================================================

app.post('/api/admin/credits/global', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const { amount = 10 } = req.body;
    const result = await prisma.user.updateMany({
      data: {
        freeBuildsTotal: {
          increment: Number(amount),
        },
      },
    });

    return res.json({
      message: `Successfully added ${amount} build credits to all ${result.count} users!`,
      affectedUsers: result.count,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to distribute global credits.' });
  }
});

app.post('/api/admin/credits/user', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const { email, amount = 10 } = req.body;
    if (!email) return res.status(400).json({ error: 'User email is required.' });

    const targetUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!targetUser) {
      return res.status(404).json({ error: `User with email "${email}" not found.` });
    }

    const updatedUser = await prisma.user.update({
      where: { email: email.trim().toLowerCase() },
      data: {
        freeBuildsTotal: {
          increment: Number(amount),
        },
      },
    });

    return res.json({
      message: `Successfully added ${amount} build credits to ${targetUser.email}!`,
      user: formatSafeUser(updatedUser),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to grant user credits.' });
  }
});

// ============================================================
// RAZORPAY PAYMENT & DYNAMIC PACKAGES ROUTES
// ============================================================

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
    const plan = PACKAGES[planKey];
    if (!plan) return res.status(400).json({ error: 'Invalid package plan.' });

    const options = {
      amount: plan.priceInInr * 100, // convert INR to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    return res.status(500).json({ error: 'Failed to create payment order.' });
  }
});

app.post('/api/payments/verify', authenticate, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planKey } = req.body;
    const plan = PACKAGES[planKey];

    if (!plan) return res.status(400).json({ error: 'Invalid package selection.' });

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment signature verification failed.' });
    }

    // Record payment ledger
    await prisma.payment.create({
      data: {
        userId: req.user.id,
        amount: plan.priceInInr,
        currency: 'INR',
        status: 'SUCCESS',
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      },
    });

    // Credit build builds to user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        freeBuildsTotal: {
          increment: plan.credits,
        },
      },
    });

    return res.json({
      success: true,
      message: 'Payment verified and credits added successfully!',
      user: formatSafeUser(updatedUser),
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ error: 'Payment verification failed.' });
  }
});

// ============================================================
// START SERVER (Render Compatible 0.0.0.0 Binding)
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`WEBTO AI Backend running on port ${PORT}`);
});
