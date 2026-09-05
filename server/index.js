import Razorpay from 'razorpay';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
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

// Expanded body payload parsing
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/', (req, res) => {
  res.send('WEBTO AI Backend & Admin Server running with PostgreSQL & Prisma!');
});

// ============================================================
// EMAIL DISPATCHER (Resend primary, Nodemailer fallback)
// ============================================================
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const transporter = process.env.ADMIN_EMAIL_SENDER && process.env.ADMIN_EMAIL_PASS
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.ADMIN_EMAIL_SENDER,
        pass: process.env.ADMIN_EMAIL_PASS,
      },
    })
  : null;

// In-memory OTP storage for admin logins
const adminOtpStore = {};

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
    credits: Math.max(0, total - used) + (rest.credits || 0),
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
// 1. ADMIN AUTHENTICATION (EMAIL OTP)
// ============================================================
app.post('/api/admin/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const adminEmail = (process.env.ADMIN_EMAIL || 'webtoai26@gmail.com').trim().toLowerCase();

    if (!email || email.trim().toLowerCase() !== adminEmail) {
      return res.status(403).json({ error: 'Unauthorized: Not an admin email address.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    adminOtpStore[adminEmail] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };

    console.log(`>>> WEBTO ADMIN OTP: ${otp} <<<`);

    const emailSubject = '🔐 WEBTO AI Admin Access OTP';
    const emailHtml = `
      <div style="background:#070b14; color:#fff; padding:28px; border-radius:14px; font-family:sans-serif; max-width:440px; margin:auto;">
        <h2 style="color:#60a5fa; margin:0 0 10px;">WEBTO AI Security</h2>
        <p style="color:#94a3b8; font-size:13px;">Your one-time login authentication code is:</p>
        <div style="background:#0e1626; border:1px solid #1e293b; padding:14px; border-radius:10px; text-align:center; margin:16px 0;">
          <span style="font-size:26px; letter-spacing:6px; font-weight:bold; color:#38bdf8; font-family:monospace;">${otp}</span>
        </div>
        <p style="color:#64748b; font-size:11px;">This OTP expires in 10 minutes.</p>
      </div>
    `;

    if (resend) {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: [adminEmail],
        subject: emailSubject,
        html: emailHtml,
      });
      return res.json({ success: true, message: 'OTP sent to your email.' });
    }

    if (transporter) {
      await transporter.sendMail({
        from: `"WEBTO AI Security" <${process.env.ADMIN_EMAIL_SENDER}>`,
        to: adminEmail,
        subject: emailSubject,
        html: emailHtml,
      });
      return res.json({ success: true, message: 'OTP sent to your email.' });
    }

    return res.json({ success: true, devOtp: otp, message: 'OTP generated (Check server logs).' });
  } catch (err) {
    console.error('Admin OTP Dispatch Error:', err);
    return res.status(500).json({ error: 'Failed to send admin OTP.' });
  }
});

app.post('/api/admin/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const record = adminOtpStore[cleanEmail];

    if (!record || record.otp !== (otp || '').trim() || Date.now() > record.expiresAt) {
      return res.status(400).json({ error: 'Invalid or expired OTP code.' });
    }

    delete adminOtpStore[cleanEmail];

    let adminUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: 'Admin User',
          role: 'ADMIN',
          freeBuildsTotal: 99999,
        },
      });
    } else if (adminUser.role !== 'ADMIN') {
      await prisma.user.update({ where: { id: adminUser.id }, data: { role: 'ADMIN' } });
    }

    const token = jwt.sign({ userId: adminUser.id, role: 'ADMIN', email: cleanEmail }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ success: true, token, user: adminUser });
  } catch (err) {
    console.error('Admin Verify Error:', err);
    return res.status(500).json({ error: 'Failed to verify admin OTP.' });
  }
});

// ============================================================
// 2. ADMIN DASHBOARD DATA & OVERVIEW
// ============================================================
const handleDashboardData = async (req, res) => {
  try {
    const [totalUsers, totalProjects, users, payments] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }).catch(() => []),
    ]);

    const successfulPayments = payments.filter((p) => p.status === 'SUCCESS');
    const totalRevenue = successfulPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const creditsSold = successfulPayments.reduce((acc, curr) => acc + (curr.creditsGranted || curr.credits || 0), 0);

    const safeUsers = users.map((u) => {
      const total = u.freeBuildsTotal ?? 3;
      const used = u.freeBuildsUsed ?? 0;
      const balance = Math.max(0, total - used) + (u.credits || 0);
      return {
        id: u.id,
        name: u.name || 'Anonymous',
        email: u.email,
        credits: balance,
        role: u.role || 'USER',
        createdAt: u.createdAt,
      };
    });

    const safePayments = payments.map((p) => ({
      id: p.id || p.razorpayPaymentId || 'tx_unknown',
      user: p.userId ? p.userId.slice(0, 8) : 'Anonymous',
      amount: `₹${p.amount}`,
      status: p.status === 'SUCCESS' ? 'Success' : 'Failed',
      creditsGranted: p.creditsGranted || p.credits || 0,
      date: new Date(p.createdAt).toLocaleDateString('en-GB'),
    }));

    return res.json({
      totalUsers,
      totalProjects,
      totalRevenue,
      creditsSold,
      users: safeUsers,
      payments: safePayments,
      transactions: safePayments,
      metrics: {
        totalUsers: totalUsers.toString(),
        totalProjects: totalProjects.toString(),
        totalRevenue: `₹${totalRevenue}`,
        creditsSold: creditsSold.toString(),
      },
    });
  } catch (error) {
    console.error('Dashboard Overview error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch overview data' });
  }
};

app.get('/api/admin/overview', handleDashboardData);
app.get('/api/admin/dashboard-data', handleDashboardData);
app.get('/api/admin/payments', handleDashboardData);

// ============================================================
// 3. CREDIT MANAGEMENT
// ============================================================
const handleGlobalCredits = async (req, res) => {
  try {
    const { amount } = req.body;
    const addCredits = parseInt(amount, 10) || 5;

    await prisma.user.updateMany({
      data: {
        freeBuildsTotal: { increment: addCredits },
      },
    });

    return res.json({ success: true, message: `Granted ${addCredits} credits globally!` });
  } catch (err) {
    console.error('Global credit error:', err);
    return res.status(500).json({ error: 'Failed to grant global credits' });
  }
};

app.post('/api/admin/credits/global', handleGlobalCredits);
app.post('/api/admin/credits/grant-global', handleGlobalCredits);

const handleUserCredits = async (req, res) => {
  try {
    const { email, amount, delta, userId } = req.body;
    const change = parseInt(amount ?? delta, 10) || 0;

    let whereClause = {};
    if (email) whereClause = { email: email.trim().toLowerCase() };
    else if (userId) whereClause = { id: userId };
    else return res.status(400).json({ error: 'Email or User ID required' });

    const updated = await prisma.user.update({
      where: whereClause,
      data: {
        freeBuildsTotal: { increment: change },
      },
    });

    return res.json({ success: true, message: `Adjusted credits for ${updated.name || updated.email}`, user: updated });
  } catch (err) {
    console.error('User credit adjust error:', err);
    return res.status(500).json({ error: 'Failed to adjust user credits' });
  }
};

app.post('/api/admin/credits/user', handleUserCredits);
app.post('/api/admin/credits/adjust-user', handleUserCredits);

// ============================================================
// 4. PACKAGE PRICING & SYNC
// ============================================================
const handleGetPackages = async (req, res) => {
  try {
    let packages = [];
    try {
      packages = await prisma.pricingPackage.findMany();
    } catch (e) {
      console.warn('pricingPackage table lookup note:', e.message);
    }

    const packageMap = {
      starter: { name: 'Starter', priceInInr: 149, credits: 100 },
      builder: { name: 'Builder', priceInInr: 449, credits: 500 },
      pro: { name: 'Pro', priceInInr: 999, credits: 1500 },
    };

    packages.forEach((pkg) => {
      packageMap[pkg.id] = {
        name: pkg.name || (pkg.id.charAt(0).toUpperCase() + pkg.id.slice(1)),
        priceInInr: pkg.priceInInr,
        credits: pkg.credits,
      };
    });

    return res.json({ packages: packageMap });
  } catch (err) {
    console.error('Package fetch error:', err);
    return res.status(500).json({ error: 'Failed to load packages' });
  }
};

app.get('/api/payments/packages', handleGetPackages);
app.get('/api/packages', handleGetPackages);

const handlePackageUpdate = async (req, res) => {
  try {
    const {
      packageId,
      id,
      price,
      credits,
      name,
      starterPrice,
      starterCredits,
      builderPrice,
      builderCredits,
      proPrice,
      proCredits,
    } = req.body;

    const upserts = [];

    if (starterPrice !== undefined || starterCredits !== undefined) {
      upserts.push(
        prisma.pricingPackage.upsert({
          where: { id: 'starter' },
          update: {
            ...(starterPrice !== undefined && { priceInInr: Number(starterPrice) }),
            ...(starterCredits !== undefined && { credits: Number(starterCredits) }),
          },
          create: { id: 'starter', name: 'Starter', priceInInr: Number(starterPrice) || 149, credits: Number(starterCredits) || 100 },
        })
      );
    }

    if (builderPrice !== undefined || builderCredits !== undefined) {
      upserts.push(
        prisma.pricingPackage.upsert({
          where: { id: 'builder' },
          update: {
            ...(builderPrice !== undefined && { priceInInr: Number(builderPrice) }),
            ...(builderCredits !== undefined && { credits: Number(builderCredits) }),
          },
          create: { id: 'builder', name: 'Builder', priceInInr: Number(builderPrice) || 449, credits: Number(builderCredits) || 500 },
        })
      );
    }

    if (proPrice !== undefined || proCredits !== undefined) {
      upserts.push(
        prisma.pricingPackage.upsert({
          where: { id: 'pro' },
          update: {
            ...(proPrice !== undefined && { priceInInr: Number(proPrice) }),
            ...(proCredits !== undefined && { credits: Number(proCredits) }),
          },
          create: { id: 'pro', name: 'Pro', priceInInr: Number(proPrice) || 999, credits: Number(proCredits) || 1500 },
        })
      );
    }

    const targetId = (packageId || id)?.toLowerCase().trim();
    if (targetId && upserts.length === 0) {
      upserts.push(
        prisma.pricingPackage.upsert({
          where: { id: targetId },
          update: {
            ...(price !== undefined && { priceInInr: Number(price) }),
            ...(credits !== undefined && { credits: Number(credits) }),
            ...(name && { name: String(name) }),
          },
          create: {
            id: targetId,
            name: name || (targetId.charAt(0).toUpperCase() + targetId.slice(1)),
            priceInInr: Number(price) || 0,
            credits: Number(credits) || 0,
          },
        })
      );
    }

    await Promise.all(upserts);
    return res.json({ success: true, message: 'Packages updated successfully' });
  } catch (err) {
    console.error('Package update error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update packages' });
  }
};

app.post('/api/admin/packages/update', handlePackageUpdate);
app.post('/api/admin/packages/save', handlePackageUpdate);

// ============================================================
// 5. USER AUTH & REGISTRATION (webtoai.vercel.app)
// ============================================================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, authProvider } = req.body;
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
          ...(authProvider ? { authProvider } : {}),
        },
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
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

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
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
// 6. GITHUB & GOOGLE OAUTH
// ============================================================
app.post('/api/auth/oauth', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

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

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ token, user: formatSafeUser(user) });
  } catch (error) {
    console.error('OAuth direct error:', error);
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

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ token, user: formatSafeUser(user) });
  } catch (error) {
    console.error('Google OAuth error:', error);
    return res.status(500).json({ error: 'Google authentication failed.' });
  }
});

// ============================================================
// 7. PROJECT DATA & GENERATION (BYOK & CUSTOM API KEY READY)
// ============================================================
app.get('/api/projects', authenticate, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      include: prisma.file ? { files: true } : undefined,
    });
    return res.json({ projects });
  } catch (err) {
    console.error('Fetch projects error:', err);
    return res.status(500).json({ error: 'Failed to retrieve projects.' });
  }
});

app.post('/api/projects', authenticate, async (req, res) => {
  try {
    const { name, description, type } = req.body;
    const project = await prisma.project.create({
      data: {
        userId: req.user.id,
        name: name || 'Untitled Web Application',
        description: description || '',
        type: type || 'FULL_STACK',
        isPublic: false,
        entryHtml: '',
      },
    });
    return res.json({ project });
  } catch (err) {
    console.error('Create project error:', err);
    return res.status(500).json({ error: 'Failed to initialize project.' });
  }
});

app.get('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
      include: prisma.file ? { files: true } : undefined,
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    return res.json({ project });
  } catch (err) {
    console.error('Get project error:', err);
    return res.status(500).json({ error: 'Failed to fetch project details.' });
  }
});

app.put('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const updated = await prisma.project.updateMany({
      where: { id, userId: req.user.id },
      data: { name },
    });

    return res.json({ success: true, updated });
  } catch (err) {
    console.error('Update project name error:', err);
    return res.status(500).json({ error: 'Failed to update project name.' });
  }
});

app.delete('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (prisma.file?.deleteMany) {
      await prisma.file.deleteMany({ where: { projectId: id } }).catch(() => {});
    }
    await prisma.project.deleteMany({ where: { id, userId: req.user.id } });
    return res.json({ success: true, message: 'Project deleted successfully.' });
  } catch (err) {
    console.error('Delete project error:', err);
    return res.status(500).json({ error: 'Failed to delete project.' });
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
    console.error('Project visibility update error:', err);
    return res.status(500).json({ error: 'Failed to update visibility.' });
  }
});

app.patch('/api/projects/:id/seo', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, description } = req.body;

    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const updated = await prisma.project.update({
      where: { id },
      data: {
        name: title || project.name,
        slug: slug || project.slug,
        description: description || project.description,
      },
      include: prisma.file ? { files: true } : undefined,
    });

    return res.json({ success: true, project: updated });
  } catch (err) {
    console.error('SEO settings update error:', err);
    return res.status(500).json({ error: 'Failed to update project SEO.' });
  }
});

// PRIMARY AI SYNTHESIS GENERATOR (REPLIT / BYOK COMPLIANT)
app.post('/api/generate/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { prompt, image, customApiKey } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User session not found.' });

    // If user provides their own key (BYOK), skip platform quota restrictions
    if (!customApiKey) {
      const totalAllowed = (user.freeBuildsTotal ?? 3) + (user.credits || 0);
      const used = user.freeBuildsUsed ?? 0;

      if (totalAllowed > 0 && used >= totalAllowed) {
        return res.status(403).json({
          error: 'Platform quota exceeded. Connect your own Gemini API key or refill credits.',
          totalAllowed,
          used,
        });
      }
    }

    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
      include: prisma.file ? { files: true } : undefined,
    });

    if (!project) {
      return res.status(404).json({ error: 'Target project session not found.' });
    }

    const indexFile = project.files?.find((f) => f.name === 'index.html');
    const existingCode = indexFile?.content || project.entryHtml || '';

    // Invoke synthesis engine passing optional custom key
    const generated = await generateProjectCode(
      prompt,
      project.type || 'FULL_STACK',
      existingCode,
      image,
      customApiKey
    );

    if (!generated || !generated.entryHtml) {
      return res.status(500).json({ error: 'AI engine generated an empty output. Please retry.' });
    }

    // Safely delete and persist files only if file model exists in prisma
    const createdFiles = [];
    if (prisma.file?.deleteMany) {
      await prisma.file.deleteMany({ where: { projectId: id } }).catch(() => {});
      if (generated.files && generated.files.length > 0) {
        for (const file of generated.files) {
          try {
            const newFile = await prisma.file.create({
              data: {
                projectId: id,
                name: file.name,
                path: file.path || `/${file.name}`,
                content: file.content || '',
              },
            });
            createdFiles.push(newFile);
          } catch {
            // Ignore file table schema differences
          }
        }
      }
    }

    await prisma.project.update({
      where: { id },
      data: {
        entryHtml: generated.entryHtml,
        updatedAt: new Date(),
      },
    });

    // Only increment database usage when using default platform credits
    let remainingCredits = user.credits || 0;
    if (!customApiKey) {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { freeBuildsUsed: { increment: 1 } },
      });
      remainingCredits = updatedUser.credits;
    }

    return res.json({
      success: true,
      entryHtml: generated.entryHtml,
      files: createdFiles.length > 0 ? createdFiles : [{ name: 'index.html', path: '/index.html', content: generated.entryHtml }],
      remainingCredits,
    });
  } catch (err) {
    console.error('[GENERATE ENDPOINT ERROR]:', err);
    return res.status(500).json({ error: err.message || 'Generation synthesis failed.' });
  }
});

// INTERACTIVE ARCHITECTURE PLANNING CHAT
app.post('/api/chat/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { messages, customApiKey } = req.body;

    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
    });

    const reply = await generateChatReply(
      project?.name || 'Web App',
      project?.type || 'FULL_STACK',
      messages || [],
      customApiKey
    );

    return res.json(reply);
  } catch (err) {
    console.error('Chat endpoint error:', err);
    return res.status(500).json({ error: err.message || 'Chat assistant failed.' });
  }
});

// ============================================================
// 8. DEPLOYMENT & EXPORT HANDLERS
// ============================================================
app.get('/api/deployments', authenticate, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.id, isPublic: true },
      orderBy: { updatedAt: 'desc' },
    });

    const deployments = projects.map((p) => ({
      id: p.id,
      name: p.name,
      deployedUrl: `https://webtoai.vercel.app/preview/${p.slug || p.id}`,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return res.json({ deployments });
  } catch (err) {
    console.error('Get deployments error:', err);
    return res.status(500).json({ error: 'Failed to retrieve deployments.' });
  }
});

app.post('/api/deploy/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const deployedUrl = `https://webtoai.vercel.app/preview/${project.slug || project.id}`;
    const updated = await prisma.project.update({
      where: { id },
      data: { isPublic: true },
    });

    return res.json({ success: true, deployedUrl, project: updated });
  } catch (err) {
    console.error('Deploy error:', err);
    return res.status(500).json({ error: 'Deployment failed.' });
  }
});

app.delete('/api/deploy/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!project) return res.status(404).json({ error: 'Project not found.' });

    await prisma.project.update({
      where: { id },
      data: { isPublic: false },
    });

    return res.json({ success: true, message: 'Deployment removed.' });
  } catch (err) {
    console.error('Delete deployment error:', err);
    return res.status(500).json({ error: 'Failed to undeploy project.' });
  }
});

app.post('/api/github/push/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { githubToken, repoName, isPrivate } = req.body;

    if (!githubToken || !repoName) {
      return res.status(400).json({ error: 'GitHub token and repository name are required.' });
    }

    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.id },
      include: prisma.file ? { files: true } : undefined,
    });

    if (!project) return res.status(404).json({ error: 'Project not found.' });

    // Create repository on GitHub via Octokit / REST API
    const createRepoRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repoName.replace(/[^a-zA-Z0-9._-]/g, '-'),
        private: !!isPrivate,
        auto_init: true,
      }),
    });

    const repoData = await createRepoRes.json();
    if (!createRepoRes.ok && createRepoRes.status !== 422) {
      throw new Error(repoData.message || 'Failed to create GitHub repository');
    }

    const repoUrl = repoData.html_url || `https://github.com/${repoName}`;
    return res.json({ success: true, repoUrl });
  } catch (err) {
    console.error('GitHub export error:', err);
    return res.status(500).json({ error: err.message || 'Failed to push to GitHub.' });
  }
});

// ============================================================
// 9. PUBLIC PREVIEW ENDPOINT (NO AUTH REQUIRED)
// ============================================================
app.get('/api/public/preview/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findFirst({
      where: {
        OR: [{ id: id }, { slug: id }],
      },
    });

    if (!project || !project.entryHtml) {
      return res.status(404).json({ error: 'Published website not found or has no content.' });
    }

    return res.json({
      success: true,
      name: project.name,
      entryHtml: project.entryHtml,
    });
  } catch (err) {
    console.error('Public preview error:', err);
    return res.status(500).json({ error: 'Failed to retrieve preview.' });
  }
});

// START EXPRESS SERVER
app.listen(PORT, () => {
  console.log(`[SERVER] WEBTO AI running securely on port ${PORT}`);
});
