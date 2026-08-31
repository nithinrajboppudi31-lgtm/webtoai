import Razorpay from 'razorpay';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
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

app.use(express.json());

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

// Nodemailer Transporter solely for Admin OTP delivery
const adminTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.ADMIN_GMAIL_USER || 'webtoai26@gmail.com',
    pass: process.env.ADMIN_GMAIL_PASS,
  },
});

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

    // Print OTP in terminal logs for backup access
    console.log('------------------------------------');
    console.log(`>>> WEBTO ADMIN OTP: ${generatedOtp} <<<`);
    console.log('------------------------------------');

    if (process.env.ADMIN_GMAIL_PASS) {
      try {
        await adminTransporter.sendMail({
          from: `"WEBTO AI Security" <${process.env.ADMIN_GMAIL_USER || 'webtoai26@gmail.com'}>`,
          to: adminEmail,
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
      } catch (emailErr) {
        console.error('Nodemailer admin delivery error:', emailErr.message);
      }
    } else {
      console.warn('⚠️ ADMIN_GMAIL_PASS not set in environment. Check terminal logs for OTP.');
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

// ============================================================
// AUTH ROUTES
// ============================================================

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
    const isPasswordMatch = await bcrypt.compare(cleanInputPassword, user.password);

    if (isPasswordMatch) {
      isAuthenticated = true;
    } else if (user.resetPasswordToken && user.resetPasswordExpires) {
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
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

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

    res.json({
      success: true,
      message: 'If an account exists for this email, a reset code has been sent.',
    });

    if (resend) {
      resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'WEBTO AI <onboarding@resend.dev>',
        to: [cleanEmail],
        subject: 'Your WEBTO AI Temporary Access Code',
        text: `Your WEBTO AI temporary access code is: ${resetCode}. It expires in 15 minutes.`,
        html: `
          <div style="background-color:#070b14; color:#ffffff; padding:32px; font-family:Arial,sans-serif; border-radius:16px; max-width:480px; margin:0 auto;">
            <h2 style="color:#60a5fa; margin-bottom:8px;">WEBTO AI</h2>
            <h3 style="color:#ffffff; margin-top:0;">Temporary Access Code</h3>
            <p style="color:#94a3b8; font-size:13px;">We received a request to reset your WEBTO AI password.</p>
            <div style="margin:24px 0; padding:16px; background:#0e1626; border:1px solid #1e293b; border-radius:12px; text-align:center;">
              <span style="font-family:monospace; font-size:24px; letter-spacing:4px; font-weight:bold; color:#38bdf8;">${resetCode}</span>
            </div>
            <p style="color:#94a3b8; font-size:12px;">This code expires in 15 minutes.</p>
          </div>
        `,
      }).catch((emailError) => console.error('Email error:', emailError.message));
    }
  } catch (err) {
    console.error('Reset code error:', err);
    return res.status(500).json({ error: 'Failed to generate reset code.' });
  }
});

// ============================================================
// CREDITS ROUTE
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

// ============================================================
// PROJECTS CRUD
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

// ============================================================
// AI CHAT & GENERATION
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
// RAZORPAY PAYMENT ROUTES
// ============================================================

const PACKAGES = {
  starter: { name: 'Starter Plan', credits: 100, priceInInr: 99 },
  builder: { name: 'Builder Plan', credits: 500, priceInInr: 399 },
  pro: { name: 'Pro Plan', credits: 1500, priceInInr: 999 },
};

app.get('/api/payments/packages', (req, res) => {
  return res.json({ packages: PACKAGES });
});

// ============================================================
// GOOGLE AUTH
// ============================================================

app.post('/api/auth/google', async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) return res.status(400).json({ error: 'Access token is required' });

    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!googleRes.ok) return res.status(401).json({ error: 'Failed to verify Google user' });

    const profile = await googleRes.json();
    const { email, name, picture } = profile;

    const user = {
      id: email,
      name: name || email.split('@')[0],
      email: email,
      credits: 3,
      picture: picture || '',
    };

    return res.status(200).json({
      token: 'google-session-token-' + Date.now(),
      user,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Google authentication failed' });
  }
});

// ============================================================
// START SERVER (Render Compatible 0.0.0.0 Binding)
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`WEBTO AI Backend running on port ${PORT}`);
});