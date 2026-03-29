'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, RefreshCw, ExternalLink, AlertTriangle, Key, CreditCard, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatNumber } from '@/lib/utils';

const PLAN_FEATURES: Record<string, { daily: number; perMinute: number; perHour: number }> = {
  free:       { daily: 50,    perMinute: 5,   perHour: 30    },
  basic:      { daily: 500,   perMinute: 20,  perHour: 200   },
  premium:    { daily: 5000,  perMinute: 100, perHour: 2000  },
  enterprise: { daily: 50000, perMinute: 500, perHour: 15000 },
};

const PLAN_PRICES: Record<string, string> = {
  free: '$0/mo', basic: '$7.99/mo', premium: '$19.99/mo', enterprise: '$99.00/mo',
};

const PLAN_UPGRADE_ORDER = ['free', 'basic', 'premium', 'enterprise'];

export default function AccountPage() {
  const { plan, logout, isLoading: authLoading } = useAuth();

  // Key state
  const [keyPrefix, setKeyPrefix] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(true);
  const [keyVisible, setKeyVisible] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  // Rotation state
  const [rotating, setRotating] = useState(false);
  const [rotateConfirm, setRotateConfirm] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [newKeyCopied, setNewKeyCopied] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);

  const [billingLoading, setBillingLoading] = useState(false);

  // Wait for AuthProvider to finish its refresh() call and set the JWT token
  // before making any authenticated API calls.
  useEffect(() => {
    if (authLoading) return;
    api.getKeyInfo()
      .then((res) => setKeyPrefix(res.data.keyPrefix))
      .catch(() => setKeyPrefix(null))
      .finally(() => setKeyLoading(false));
  }, [authLoading]);

  // Click anywhere on the key field → copy + flash confirmation
  const handleKeyCopy = () => {
    const value = newKey ?? keyPrefix;
    if (!value) return;
    navigator.clipboard.writeText(value);
    if (newKey) {
      setNewKeyCopied(true);
      setTimeout(() => setNewKeyCopied(false), 2000);
    } else {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  const handleRotate = async () => {
    if (!rotateConfirm) { setRotateConfirm(true); return; }

    // If there's no access token in memory (e.g. after a page refresh without
    // re-login), the request would fail with 401. Redirect to login to re-auth.
    if (!api.getToken()) {
      await logout();
      return;
    }

    setRotating(true);
    setRotateError(null);
    try {
      const res = await api.rotateKey();
      setNewKey(res.apiKey);
      setKeyPrefix(res.apiKey.slice(0, 16));
      setRotateConfirm(false);
      setKeyVisible(true); // auto-reveal so they can copy the new key
    } catch (err: unknown) {
      const e = err as { error?: string; message?: string };
      // 401 means session expired — send back to login
      if (e.error === 'unauthorized') {
        await logout();
        return;
      }
      const msg = e.message ?? 'Key rotation failed. Please try again.';
      setRotateError(msg);
      setRotateConfirm(false);
    } finally {
      setRotating(false);
    }
  };

  const handleBillingPortal = async () => {
    setBillingLoading(true);
    try {
      const res = await api.getBillingPortal();
      window.open(res.data.url, '_blank');
    } catch {
      alert('Billing portal is not available in development mode.');
    } finally {
      setBillingLoading(false);
    }
  };

  // What to display in the key field
  const displayKey = (() => {
    const value = newKey ?? keyPrefix;
    if (!value) return null;
    if (keyVisible) return value;
    // Masked: show first 12 chars + bullets
    return value.slice(0, 12) + '•'.repeat(Math.max(0, value.length - 12));
  })();

  const currentLimits = plan ? PLAN_FEATURES[plan] ?? PLAN_FEATURES.free : PLAN_FEATURES.free;
  const nextPlan = plan ? PLAN_UPGRADE_ORDER[PLAN_UPGRADE_ORDER.indexOf(plan) + 1] : null;

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Account</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your API key, plan, and billing.</p>
      </div>

      {/* API Key */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-slate-400" />
            <CardTitle>API Key</CardTitle>
          </div>
          <CardDescription>
            Your secret API key. Pass it as a Bearer token in the Authorization header.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* New key banner (shown immediately after rotation) */}
          {newKey && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-700">
              ⚠ New key generated — save it now. It won&apos;t be shown again after you leave this page.
            </div>
          )}

          {/* Key field */}
          <div
            onClick={handleKeyCopy}
            title="Click to copy"
            className={cn(
              'group relative flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all select-none',
              newKey
                ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100',
            )}
          >
            {/* Key value */}
            <code className={cn(
              'flex-1 font-mono text-sm tracking-wide',
              keyLoading ? 'text-slate-400' : keyVisible ? 'text-slate-800' : 'text-slate-500',
            )}>
              {keyLoading ? 'Loading…' : (displayKey ?? 'No active key')}
            </code>

            {/* Copy confirmation */}
            <div className={cn(
              'absolute right-12 flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-all',
              (keyCopied || newKeyCopied)
                ? 'opacity-100 bg-emerald-100 text-emerald-700'
                : 'opacity-0',
            )}>
              <Check className="h-3 w-3" /> Key copied
            </div>

            {/* Eye toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); setKeyVisible((v) => !v); }}
              className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-700 transition-colors"
              title={keyVisible ? 'Hide key' : 'Show key'}
            >
              {keyVisible
                ? <EyeOff className="h-4 w-4" />
                : <Eye className="h-4 w-4" />
              }
            </button>
          </div>

          <p className="text-xs text-slate-400">
            {keyVisible
              ? 'Only the key prefix is stored — rotate to generate a new full key.'
              : 'Click the field to copy · click the eye to reveal'}
          </p>

          {/* Rotate controls */}
          {rotateConfirm ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                This will invalidate your current key immediately.
              </div>
              <Button size="sm" variant="destructive" onClick={handleRotate} loading={rotating}>
                Confirm rotate
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRotateConfirm(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={handleRotate} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Rotate key
            </Button>
          )}

          {rotateError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {rotateError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan & Limits */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-400" />
            <CardTitle>Plan &amp; Limits</CardTitle>
          </div>
          <CardDescription>Your current plan and rate limits.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Badge
                variant={(plan as 'free' | 'basic' | 'premium' | 'enterprise') || 'free'}
                className="capitalize text-sm px-3 py-1"
              >
                {plan ?? 'free'}
              </Badge>
              <span className="text-slate-600 font-medium">
                {plan ? PLAN_PRICES[plan] : '$0/mo'}
              </span>
            </div>
            {nextPlan && (
              <Button size="sm" onClick={handleBillingPortal} loading={billingLoading} className="gap-1.5">
                Upgrade to {nextPlan.charAt(0).toUpperCase() + nextPlan.slice(1)}
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Daily lookups',  value: formatNumber(currentLimits.daily)     },
              { label: 'Per minute',     value: formatNumber(currentLimits.perMinute) },
              { label: 'Per hour',       value: formatNumber(currentLimits.perHour)   },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                <p className="mt-1 font-display text-xl font-bold text-slate-900">{stat.value}</p>
              </div>
            ))}
          </div>

          {plan === 'free' && (
            <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
              <p className="text-sm font-medium text-brand-800">
                You&apos;re on the Free plan — hard limited at 50 requests/day.
              </p>
              <p className="mt-1 text-xs text-brand-600">
                Upgrade to Basic ($7.99/mo) for 500 lookups/day with a soft cap.
              </p>
              <Button size="sm" className="mt-3" onClick={handleBillingPortal} loading={billingLoading}>
                Upgrade now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing */}
      {plan && plan !== 'free' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-slate-400" />
              <CardTitle>Billing</CardTitle>
            </div>
            <CardDescription>
              Manage your subscription, invoices, and payment methods.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleBillingPortal} loading={billingLoading} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Open billing portal
            </Button>
            <p className="mt-3 text-xs text-slate-500">
              You&apos;ll be redirected to Stripe to manage your subscription.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700">Danger zone</CardTitle>
          <CardDescription>Destructive actions for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm" onClick={logout}>
            Sign out of all devices
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
