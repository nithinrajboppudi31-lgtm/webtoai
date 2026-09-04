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

// Expanded body payload parsing
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/', (req, res) => {
  res.send('WEBTO AI Backend is running with PostgreSQL & Prisma live!');
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
    adminOtpExpiresAt = Date.now() + 10 * 60 * 1000;

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

// ============================================================
// ADMIN DASHBOARD DATA & PACKAGE SYNC ENDPOINTS
// ============================================================

// 1. Live Admin Dashboard Data Endpoint
app.get('/api/admin/dashboard-data', async (req, res) => {
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
        take: 20,
      }),
    ]);

    let dbPackages = [];
    try {
      dbPackages = await prisma.pricingPackage.findMany();
    } catch (e) {
      console.warn('pricingPackage table read notice:', e.message);
    }

    const defaultPackages = [
      { id: 'starter', name: 'Starter', price: '₹149', priceVal: 149, credits: '100 Credits', creditsVal: 100 },
      { id: 'builder', name: 'Builder', price: '₹449', priceVal: 449, credits: '500 Credits', creditsVal: 500 },
      { id: 'pro', name: 'Pro', price: '₹999', priceVal: 999, credits: '1500 Credits', creditsVal: 1500 },
    ];

    const creditPackages = defaultPackages.map((def) => {
      const found = dbPackages.find((p) => p.id === def.id);
      if (found) {
        return {
          id: found.id,
          name: found.name || def.name,
          price: `₹${found.priceInInr}`,
          priceVal: found.priceInInr,
          credits: `${found.credits} Credits`,
          creditsVal: found.credits,
        };
      }
      return def;
    });

    const totalRevenueSum = payments
      .filter((p) => p.status === 'SUCCESS')
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);

    const totalCreditsSold = payments
      .filter((p) => p.status === 'SUCCESS')
      .reduce((acc, curr) => acc + (curr.credits || 0), 0);

    return res.json({
      stats: {
        totalUsers,
        totalProjects,
        totalRevenue: `₹${totalRevenueSum.toLocaleString()}`,
        creditsSold: totalCreditsSold,
        activeDeployments: totalProjects,
      },
      users: users.map(formatSafeUser),
      transactions: payments.map((tx) => ({
        id: tx.id,
        user: tx.userId ? tx.userId.slice(0, 8) : 'Anonymous',
        amount: `₹${tx.amount}`,
        status: tx.status === 'SUCCESS' ? 'Success' : 'Failed',
        date: new Date(tx.createdAt).toLocaleDateString(),
      })),
      creditPackages,
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch dashboard data' });
  }
});

// 2. Persistent Package Update Endpoint
app.post('/api/admin/packages/update', async (req, res) => {
  try {
    const { packageId, price, credits, name } = req.body;
    if (!packageId) {
      return res.status(400).json({ error: 'packageId is required' });
    }

    const cleanId = String(packageId).toLowerCase().trim();
    const numPrice = parseInt(price, 10);
    const numCredits = parseInt(credits, 10);

    if (isNaN(numPrice) || isNaN(numCredits)) {
      return res.status(400).json({ error: 'Valid numeric price and credits required' });
    }

    const updated = await prisma.pricingPackage.upsert({
      where: { id: cleanId },
      update: {
        priceInInr: numPrice,
        credits: numCredits,
        ...(name ? { name: String(name) } : {}),
      },
      create: {
        id: cleanId,
        name: name || (cleanId.charAt(0).toUpperCase() + cleanId.slice(1)),
        priceInInr: numPrice,
        credits: numCredits,
      },
    });

    console.log('Saved package update to database:', updated);
    return res.json({ success: true, package: updated });
  } catch (error) {
    console.error('Error updating pricingPackage in DB:', error);
    return res.status(500).json({ error: error.message || 'Database update failed' });
  }
});

// 3. Grant Global Credits Endpoint
app.post('/api/admin/credits/grant-global', async (req, res) => {
  try {
    const { amount } = req.body;
    const addCredits = parseInt(amount, 10) || 5;

    await prisma.user.updateMany({
      data: {
        freeBuildsTotal: {
          increment: addCredits,
        },
      },
    });

    return res.json({ success: true, message: `Granted ${addCredits} credits to all users.` });
  } catch (error) {
    console.error('Grant global credits error:', error);
    return res.status(500).json({ error: error.message || 'Failed to grant global credits' });
  }
});

// 4. Adjust Single User Credit Endpoint
app.post('/api/admin/credits/adjust-user', async (req, res) => {
  try {
    const { userId, delta } = req.body;
    const deltaNum = parseInt(delta, 10) || 0;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        freeBuildsTotal: {
          increment: deltaNum,
        },
      },
    });

    return res.json({ success: true, user: formatSafeUser(updated) });
  } catch (error) {
    console.error('Adjust user credit error:', error);
    return res.status(500).json({ error: error.message || 'Failed to adjust user credits' });
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

// Public packages fetch for main site
app.get('/api/packages', async (req, res) => {
  try {
    const packages = await prisma.pricingPackage.findMany();
    const packageMap = {
      starter: { priceInInr: 149, credits: 100 },
      builder: { priceInInr: 449, credits: 500 },
      pro: { priceInInr: 999, credits: 1500 },
    };

    packages.forEach((pkg) => {
      packageMap[pkg.id] = {
        priceInInr: pkg.priceInInr,
        credits: pkg.credits,
      };
    });

    return res.json({ packages: packageMap });
  } catch (error) {
    console.error('Error fetching packages:', error);
    return res.status(500).json({ error: 'Failed to fetch packages.' });
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

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('❌ Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET on Render.');
      return res.status(500).json({
        error: 'GitHub OAuth credentials missing on backend server.',
      });
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'WEBTOAI-App',
      },
      body: JSON.stringify({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        code: code.trim(),
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error || !tokenData.access_token) {
      return res.status(401).json({ 
        error: tokenData.error_description || tokenData.error || 'Failed to exchange GitHub authorization token' 
      });
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: { 
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'WEBTOAI-App',
      },
    });
    
    if (!userRes.ok) {
      return res.status(401).json({ error: 'Failed to fetch user profile from GitHub' });
    }
    
    const profile = await userRes.json();

    let email = profile.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { 
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'WEBTOAI-App',
        },
      });
      if (emailRes.ok) {
        const emails = await emailRes.json();
        const primaryEmail = emails.find((e) => e.primary && e.verified);
        if (primaryEmail) email = primaryEmail.email;
      }
    }

    if (!email) {
      email = `${profile.login}@users.noreply.github.com`;
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      const dummyPass = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: profile.name || profile.login,
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

// Single app.listen call to avoid duplicate port errors
app.listen(PORT, '0.0.0.0', () => {
  console.log(`WEBTO AI Backend running on port ${PORT}`);
});
