import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Coins, Check, Zap, History, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

export default function Credits() {
  const { user, token, setUser } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);

  const buildsUsed = user?.freeBuildsUsed ?? 0;
  const buildsTotal = user?.freeBuildsTotal ?? 3;
  const buildsLeft = Math.max(0, buildsTotal - buildsUsed);
  const usagePercentage = Math.min(100, Math.round((buildsUsed / buildsTotal) * 100));

  const plans = [
    {
      key: 'starter',
      name: 'Starter',
      price: '₹99',
      credits: '100 Builds',
      rawCredits: 100,
      features: ['100 AI Generations', 'Live Preview Sandbox', 'ZIP Source Export', 'Community Support'],
      popular: false,
    },
    {
      key: 'builder',
      name: 'Builder',
      price: '₹399',
      credits: '500 Builds',
      rawCredits: 500,
      features: ['500 AI Generations', 'Full-Stack Deployments', 'AI Discovery Architect', 'Snapshot History Rollback'],
      popular: true,
    },
    {
      key: 'pro',
      name: 'Pro',
      price: '₹999',
      credits: '1,500 Builds',
      rawCredits: 1500,
      features: ['1,500 AI Generations', 'Unlimited Deployments', 'Priority Gemini 3.6 Speed', 'Dedicated 24/7 Support'],
      popular: false,
    },
  ];

  useEffect(() => {
    loadTransactions();
    loadRazorpayScript();
  }, []);

  const loadRazorpayScript = () => {
    if (document.getElementById('razorpay-checkout-js')) return;
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  };

  const loadTransactions = async () => {
    setLoadingTx(true);
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch('https://webtoai-backend.onrender.com/api/payments/transactions', {
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

  const handlePurchasePlan = async (plan) => {
    setLoadingPlan(plan.key);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const authToken = token || localStorage.getItem('token');

      // 1. Create order on backend
      const res = await fetch('https://webtoai-backend.onrender.com/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ planKey: plan.key }),
      });

      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.error || 'Could not initiate checkout.');

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'WEBTO AI',
        description: `Upgrade: ${plan.name} (${plan.credits})`,
        order_id: orderData.orderId,
        modal: {
          ondismiss: function () {
            setLoadingPlan(null);
          },
        },
        handler: async function (response) {
          try {
            // 3. Verify payment signature on backend
            const verifyRes = await fetch('https://webtoai-backend.onrender.com/api/payments/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planKey: plan.key,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed.');

            if (setUser && verifyData.user) {
              setUser(verifyData.user);
            }

            setSuccessMsg(`Success! ${plan.credits} added to your account.`);
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
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <Coins className="w-6 h-6 text-amber-400" />
          Credits & Billing
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Top up your AI build allocation with instant Razorpay checkout.
        </p>
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

      {/* Balance Summary Card */}
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

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <div
            key={p.key}
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
                <span className="text-3xl font-black text-white">{p.price}</span>
                <span className="text-xs text-slate-400">/ {p.credits}</span>
              </div>
              <ul className="mt-6 space-y-2.5">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => handlePurchasePlan(p)}
              disabled={loadingPlan === p.key}
              className={`mt-8 w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                p.popular
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              {loadingPlan === p.key ? (
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
        ))}
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
    </div>
  );
}