'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ApiError } from '@/lib/api';

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ['confirm'],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    const token = searchParams.get('token');
    if (!token) {
      setServerError('Invalid reset link. Please request a new one.');
      return;
    }
    setServerError(null);
    try {
      await api.resetPassword(token, data.password);
      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      const apiErr = err as ApiError;
      setServerError(apiErr.message || 'Reset failed. The link may have expired.');
    }
  };

  if (done) {
    return (
      <div className="animate-slide-up text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Password reset!</h1>
        <p className="mt-3 text-sm text-slate-600">
          You can now sign in with your new password. Redirecting…
        </p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-slate-900">Set new password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose a strong password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="password">
            New password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Minimum 8 characters"
            error={errors.password?.message}
            {...register('password')}
          />
          {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="confirm">
            Confirm password
          </label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            error={errors.confirm?.message}
            {...register('confirm')}
          />
          {errors.confirm && <p className="text-xs text-red-600">{errors.confirm.message}</p>}
        </div>

        {serverError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {serverError}
            {' '}
            <Link href="/forgot-password" className="underline">Request new link.</Link>
          </div>
        )}

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Reset password
        </Button>
      </form>
    </div>
  );
}
