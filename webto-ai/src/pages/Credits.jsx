import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Coins, Check, Zap, History, ShieldCheck, AlertCircle, Loader2, Share2, Users, X, Copy, CheckCheck } from 'lucide-react';

const API_BASE = 'https://webtoai-backend.onrender.com';

export default function Credits() {
  const { user, token, setUser } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Account / Workspace Share Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [targetShareEmail, setTargetShareEmail] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareResultLink, setShareResultLink] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [shareStatus, setShareStatus] = useState({ type: '', msg: '' });

  // Calculate live user balance
  const buildsUsed = user?.freeBuildsUsed ?? 0;
  const buildsTotal = user?.freeBuildsTotal ?? 3;
  const buildsLeft = Math.max(0, buildsTotal - buildsUsed) + (user?.credits || 0);
  const usagePercentage = Math.min(100, Math.round((buildsUsed / Math.max(1, buildsTotal)) * 100));

  useEffect(() => {
    loadLivePackages();
    loadTransactions();
    loadRazorpayScript();
  }, []);

  // 1. Fetch live packages dynamically controlled by Admin Dashboard
  const loadLivePackages = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/payments/packages`);
      const data = await res.json();
      if (res.ok && data.packages) {
        if (Array.isArray(data.packages)) {
          setPlans(data.packages);
        } else {
          // Format object to array fallback
          const list = Object.entries(data.packages).map(([k, v]) => ({
            id: k,
            name: v.name,
            priceInInr: v.priceInInr,
            credits: v.credits,
            popular: k === 'builder',
            features: [
              `${v.credits} AI Generations`,
              'Full-Stack Deployments',
              'AI Discovery Architect',
              'Snapshot History Rollback'
            ]
          }));
          setPlans(list);
        }
      }
    } catch (err) {
      console.error('Fetch packages error:', err);
    } finally {
      setLoadingPlans(false);
    }
  };

  // 2. Load Razorpay script
  const loadRazorpayScript = () => {
    if (document.getElementById('razorpay-checkout-js')) return;
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  };

  // 3. Fetch user transactions ledger
  const loadTransactions = async () => {
    setLoadingTx(true);
    try {
      const authToken = token || localStorage.getItem('token') || localStorage.getItem('webto_token');
      const res = await fetch(`${API_BASE}/api/payments/transactions`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok && data.transactions) {
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error('Fetch transactions error:', err);
    } finally {
      setLoadingTx(false);
    }
  };

  // 4. Handle Account / Workspace Sharing
  const handleShareAccount = async (e) => {
    e.preventDefault();
    setShareStatus({ type: '', msg: '' });
    setShareLoading(true);

    try {
      const authToken = token || localStorage.getItem('token') || localStorage.getItem('webto_token');
      const res = await fetch(`${API_BASE}/api/share/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ targetEmail: targetShareEmail.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate invitation.');

      setShareResultLink(data.shareUrl || `${window.location.origin}/?shared_by=${encodeURIComponent(user?.email || '')}`);
      setShareStatus({ type: 'success', msg: data.message || `Invitation created for ${targetShareEmail.trim()}!` });
    } catch (err) {
      setShareStatus({ type: 'error', msg: err.message });
    } finally {
      setShareLoading(false);
    }
  };

  const copyShareLink = () => {
    if (!shareResultLink) return;
    navigator.clipboard.writeText(shareResultLink);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  // 5. Initiate Razorpay Checkout for the chosen dynamic plan
  const handlePurchasePlan = async (plan) => {
    const planKey = plan.key || plan.id || 'starter';
    setLoadingPlan(planKey);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const authToken = token || localStorage.getItem('token') || localStorage.getItem('webto_token');

      // Create order on backend
      const res = await fetch(`${API_BASE}/api/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ planKey }),
      });

      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.error || 'Could not initiate checkout.');

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'WEBTO AI',
        description: `Upgrade: ${plan.name} (${plan.credits} Builds)`,
        order_id: orderData.orderId,
        modal: {
          ondismiss: function () {
            setLoadingPlan(null);
          },
        },
        handler: async function (response) {
          try {
            const verifyRes = await fetch(`${API_BASE}/api/payments/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planKey,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed.');

            if (setUser && verifyData.user) {
              setUser(verifyData.user);
            }

            setSuccessMsg(`Success! ${plan.credits} builds added to your account.`);
            loadTransactions();
          } catch (verErr) {
            setErrorMsg(`Verification Error: ${verErr.message}`);
          } finally {
            setLoadingPlan(null);
          }
        },
        prefill: {
          name: user?.name || 'Customer',
          email: user?.email || 'customer@example.com',
          contact: '9999999999',
        },
        theme: {
          color: '#7c3aed',
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      setErrorMsg(err.message || 'Payment failed.');
      setLoadingPlan(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 max-w-6xl mx-auto bg-slate-950 text-slate-100 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Coins className="w-6 h-6 text-amber-400" />
            Credits & Billing
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Top up your AI build allocation with instant Razorpay checkout.
          </p>
        </div>

        {/* Share Account Button */}
        <button
          onClick={() => {
            setShowShareModal(true);
            setShareStatus({ type: '', msg: '' });
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 hover:text-white transition shadow-sm cursor-pointer"
        >
          <Share2 className="w-4 h-4 text-blue-400" />
          <span>Share Workspace</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Available Quota Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Available Quota</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-extrabold text-white">{buildsLeft}</span>
              <span className="text-slate-400 text-sm">/ {buildsTotal} total builds</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Every generation or code adjustment consumes 1 build credit.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Quota Utilized</span>
            <span>{usagePercentage}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                usagePercentage >= 90 ? 'bg-red-500' : usagePercentage >= 60 ? 'bg-amber-500' : 'bg-blue-600'
              }`}
              style={{ width: `${usagePercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Dynamic Packages Grid from Database */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loadingPlans ? (
          <div className="col-span-3 text-center py-12 text-slate-500 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>Loading live pricing packages...</span>
          </div>
        ) : (
          plans.map((p) => {
            const planKey = p.key || p.id;
            return (
              <div
                key={planKey}
                className={`p-6 rounded-3xl flex flex-col justify-between relative transition ${
                  p.popular
                    ? 'bg-slate-900 border-2 border-blue-500 shadow-2xl shadow-blue-500/10'
                    : 'bg-slate-900/40 border border-slate-800'
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3 right-5 px-3 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
                    Most Popular
                  </span>
                )}
                <div>
                  <h3 className="text-base font-bold text-white">{p.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">{p.price || `₹${p.priceInInr}`}</span>
                    <span className="text-xs text-slate-400">/ {p.credits} Builds</span>
                  </div>
                  <ul className="mt-6 space-y-2.5">
                    {(p.features || [
                      `${p.credits} AI Generations`,
                      'Full-Stack Deployments',
                      'Live Preview Sandbox',
                      'ZIP Source Export'
                    ]).map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => handlePurchasePlan(p)}
                  disabled={loadingPlan === planKey}
                  className={`mt-8 w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                    p.popular
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {loadingPlan === planKey ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Opening Checkout...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Buy {p.name}</span>
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Transaction History Ledger */}
      <div className="space-y-4 pt-6 border-t border-slate-900">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <History className="w-4 h-4 text-blue-400" />
          Transaction Ledger
        </h3>

        {loadingTx ? (
          <div className="p-4 text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>Loading ledger records...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-900/30 border border-slate-800/80 text-xs text-slate-500 text-center">
            No payment transactions recorded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-semibold text-white">{tx.description}</p>
                  <p className="text-[10px] text-slate-500">{new Date(tx.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-emerald-400">+{tx.amount} Builds</span>
                  <span className="block text-[10px] text-slate-400">Balance: {tx.balanceAfter}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share Account Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e1626] border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
              <Users className="w-5 h-5" />
            </div>

            <h2 className="text-base font-bold text-white mb-1">Share Account & Workspace</h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Invite team members or collaborators to access your WEBTO AI projects and shared build allocation.
            </p>

            {shareStatus.msg && (
              <div className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-xs ${
                shareStatus.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'
              }`}>
                {shareStatus.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <ShieldCheck className="w-4 h-4 shrink-0" />}
                <span>{shareStatus.msg}</span>
              </div>
            )}

            <form onSubmit={handleShareAccount} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Collaborator Email</label>
                <input
                  type="email"
                  required
                  value={targetShareEmail}
                  onChange={(e) => setTargetShareEmail(e.target.value)}
                  placeholder="collaborator@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={shareLoading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                {shareLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating Access Link...</span>
                  </>
                ) : (
                  <span>Send Workspace Invite</span>
                )}
              </button>
            </form>

            {shareResultLink && (
              <div className="mt-4 p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                <span className="block text-[10px] uppercase font-semibold text-slate-400 mb-1.5">Direct Invitation Link</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareResultLink}
                    className="flex-1 bg-transparent text-xs text-blue-400 border-none outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={copyShareLink}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                  >
                    {shareCopied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}