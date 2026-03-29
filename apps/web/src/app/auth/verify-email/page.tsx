'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, Copy, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { ApiError } from '@/lib/api';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setErrorMessage('Invalid verification link. Please check your email.');
      return;
    }

    // Call verify directly (no auth needed)
    fetch(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setApiKey(data.apiKey);
          setStatus('success');
        } else {
          const err = data as ApiError;
          setErrorMessage(err.message || 'Verification failed.');
          setStatus('error');
        }
      })
      .catch(() => {
        setErrorMessage('Something went wrong. Please try again.');
        setStatus('error');
      });
  }, [searchParams]);

  const copyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'loading') {
    return (
      <div className="animate-fade-in text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-600" />
        <p className="mt-4 text-sm text-slate-600">Verifying your email…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="animate-slide-up text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <XCircle className="h-7 w-7 text-red-600" />
        </div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Verification failed</h1>
        <p className="mt-3 text-sm text-slate-600">{errorMessage}</p>
        <div className="mt-8">
          <Link href="/login">
            <Button variant="outline">Back to sign in</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Email verified!</h1>
        <p className="mt-3 text-sm text-slate-600">
          Your account is active. Here&apos;s your API key — save it now.
        </p>
      </div>

      {apiKey && (
        <div className="mt-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
              ⚠ Save this key — it won&apos;t be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-md bg-white px-3 py-2 font-mono text-xs text-slate-800 border border-amber-200">
                {apiKey}
              </code>
              <button
                onClick={copyKey}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-white text-amber-700 hover:bg-amber-50 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 text-center">
            You can rotate your key later from the dashboard, but the current key will be invalidated.
          </p>
        </div>
      )}

      <div className="mt-6">
        <Link href="/login">
          <Button className="w-full">Go to sign in</Button>
        </Link>
      </div>
    </div>
  );
}
