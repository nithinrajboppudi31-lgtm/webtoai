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
import { generateProjectCode, generateChatReply } from './services/aiServices.js';

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
    console.error('Google auth error:', error);
    return res.status(500).json({ error: 'Google authentication failed.' });
  }
});

// ============================================================
// 7. PROJECT DATA & GENERATION
// ============================================================
app.get('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    let project = await prisma.project.findUnique({
      where: { id },
      include: { files: true },
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          id,
          name: 'New Project',
          userId: req.user.id,
          type: 'FULL_STACK',
          entryHtml: '',
        },
        include: { files: true },
      });
    }

    return res.json({ project });
  } catch (err) {
    console.error('Fetch project error:', err);
    return res.status(500).json({ error: 'Failed to retrieve project.' });
  }
});

app.post('/api/generate/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { prompt, image } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const totalAllowed = (user.freeBuildsTotal ?? 3) + (user.credits || 0);
    if ((user.freeBuildsUsed ?? 0) >= totalAllowed) {
      return res.status(403).json({ error: 'Quota exceeded. Please upgrade your credits.' });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: { files: true },
    });

    const existingHtml = project?.entryHtml || '';
    const generated = await generateProjectCode(prompt, project?.type || 'FULL_STACK', existingHtml, image);

    await prisma.user.update({
      where: { id: user.id },
      data: { freeBuildsUsed: { increment: 1 } },
    });

    if (generated.files && generated.files.length > 0) {
      await prisma.projectFile.deleteMany({ where: { projectId: id } }).catch(() => {});
      for (const file of generated.files) {
        await prisma.projectFile.create({
          data: {
            projectId: id,
            name: file.name,
            path: file.path || file.name,
            content: file.content || '',
          },
        }).catch(() => {});
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        entryHtml: generated.entryHtml,
        updatedAt: new Date(),
      },
      include: { files: true },
    });

    const remainingCredits = Math.max(0, totalAllowed - ((user.freeBuildsUsed ?? 0) + 1));

    return res.json({
      success: true,
      entryHtml: generated.entryHtml,
      files: generated.files || updatedProject.files,
      project: updatedProject,
      remainingCredits,
    });
  } catch (err) {
    console.error('Generation error:', err);
    return res.status(500).json({ error: err.message || 'Generation failed.' });
  }
});

app.post('/api/chat/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { messages } = req.body;

    const project = await prisma.project.findUnique({ where: { id } });
    const reply = await generateChatReply(project?.name, project?.type, messages);

    return res.json(reply);
  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: 'Chat service failed.' });
  }
});

// Project Visibility
app.patch('/api/projects/:id/visibility', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublic } = req.body;

    const updated = await prisma.project.update({
      where: { id },
      data: { isPublic: !!isPublic },
    });

    return res.json({ success: true, isPublic: updated.isPublic });
  } catch (err) {
    console.error('Visibility update error:', err);
    return res.status(500).json({ error: 'Failed to update visibility.' });
  }
});

// Project SEO
app.patch('/api/projects/:id/seo', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, description } = req.body;

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(title && { name: title }),
        ...(slug && { slug }),
        ...(description && { description }),
      },
    });

    return res.json({ success: true, project: updated, entryHtml: updated.entryHtml });
  } catch (err) {
    console.error('SEO update error:', err);
    return res.status(500).json({ error: 'Failed to update SEO.' });
  }
});

// ============================================================
// 8. DEPLOYMENT & GITHUB
// ============================================================
app.post('/api/deploy/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const clientUrl = process.env.CLIENT_URL || 'https://webtoai.vercel.app';
    const deployedUrl = `${clientUrl}/preview/${project.slug || project.id}`;

    const updated = await prisma.project.update({
      where: { id },
      data: {
        isDeployed: true,
        deployedUrl,
        updatedAt: new Date(),
      },
    });

    return res.json({ success: true, project: updated, deployedUrl });
  } catch (err) {
    console.error('Deploy error:', err);
    return res.status(500).json({ error: 'Deployment failed.' });
  }
});

app.post('/api/github/push/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { githubToken, repoName, isPrivate } = req.body;

    const project = await prisma.project.findUnique({
      where: { id },
      include: { files: true },
    });

    if (!project) return res.status(404).json({ error: 'Project not found.' });

    // GitHub API creation
    const repoRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repoName,
        private: !!isPrivate,
        auto_init: true,
      }),
    });

    const repoData = await repoRes.json();
    if (!repoRes.ok) {
      throw new Error(repoData.message || 'Failed to create GitHub repository.');
    }

    return res.json({
      success: true,
      repoUrl: repoData.html_url,
    });
  } catch (err) {
    console.error('GitHub export error:', err);
    return res.status(500).json({ error: err.message || 'GitHub export failed.' });
  }
});

// ============================================================
// 9. SERVER PORT BINDING (Render 0.0.0.0 Requirement)
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 WEBTO AI Server listening on port ${PORT} (0.0.0.0)`);
});
