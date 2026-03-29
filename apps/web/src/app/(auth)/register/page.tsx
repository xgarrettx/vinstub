'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ApiError } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const [done, setDone] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await api.register(data.email, data.password);
      setRegisteredEmail(data.email);
      setDone(true);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.error === 'email_taken') {
        setServerError('An account with this email already exists.');
      } else {
        setServerError(apiErr.message || 'Registration failed. Please try again.');
      }
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.resendVerification(registeredEmail);
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } finally {
      setResending(false);
    }
  };

  if (done) {
    return (
      <div className="animate-slide-up text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Check your email</h1>
        <p className="mt-3 text-sm text-slate-600">
          We sent a verification link to{' '}
          <span className="font-medium text-slate-900">{registeredEmail}</span>.
          Click it to verify your address and get your API key.
        </p>
        <p className="mt-5 text-xs text-slate-500">
          Didn&apos;t receive it? Check your spam folder, or resend below.
        </p>
        <div className="mt-4">
          {resent ? (
            <p className="text-sm font-medium text-emerald-600">
              ✓ Verification email resent
            </p>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              loading={resending}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Resend verification email
            </Button>
          )}
        </div>
        <div className="mt-6">
          <Link href="/login" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-2 text-sm text-slate-600">
          Free forever. No credit card required.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Minimum 8 characters"
            error={errors.password?.message}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-slate-500">
        By signing up you agree to our{' '}
        <Link href="/legal/terms" className="underline hover:text-slate-700">Terms</Link>
        {' '}and{' '}
        <Link href="/legal/privacy" className="underline hover:text-slate-700">Privacy Policy</Link>.
      </p>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
