'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw, Activity, Key, TrendingUp, AlertCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { api, type AccountData, type UsageDay } from '@/lib/api';
import { useAuth } from '@/contexts/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatNumber, formatPercent } from '@/lib/utils';

const PLAN_LIMITS: Record<string, number> = {
  free: 50,
  basic: 500,
  premium: 5000,
  enterprise: 50000,
};

function planBadgeVariant(plan: string): 'free' | 'basic' | 'premium' | 'enterprise' {
  return plan as 'free' | 'basic' | 'premium' | 'enterprise';
}

export default function DashboardPage() {
  const { plan } = useAuth();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [usage, setUsage] = useState<UsageDay[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getUsage().catch(() => null),
    ]).then(([usageRes]) => {
      if (usageRes?.data) {
        setUsage(usageRes.data.daily);
        setTotalRequests(usageRes.data.totalRequests);
      }
      setLoading(false);
    });
  }, []);

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dailyLimit = plan ? PLAN_LIMITS[plan] ?? 50 : 50;
  const todayUsage = usage[usage.length - 1]?.requestCount ?? 0;
  const usagePct = formatPercent(todayUsage, dailyLimit);

  const CODE_SNIPPET = `curl "https://api.vinstub.com/v1/stub?year=2020&make=Toyota&model=Camry" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Your API usage and account overview.</p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Today&apos;s usage</p>
              <Activity className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900">
              {loading ? '—' : formatNumber(todayUsage)}
              <span className="ml-1 text-sm font-normal text-slate-500">/ {formatNumber(dailyLimit)}</span>
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-brand-600',
                )}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{usagePct}% of daily quota</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">This period</p>
              <TrendingUp className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900">
              {loading ? '—' : formatNumber(totalRequests)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Total API requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Current plan</p>
              <Key className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <p className="font-display text-2xl font-bold text-slate-900 capitalize">
                {plan ?? '—'}
              </p>
              {plan && (
                <Badge variant={planBadgeVariant(plan)} className="capitalize">
                  {plan}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {plan !== 'enterprise' ? (
                <a href="/account" className="text-brand-600 hover:underline">
                  Upgrade your plan →
                </a>
              ) : (
                'Maximum tier'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage chart */}
      {usage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Request history</CardTitle>
            <CardDescription>API calls over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={usage} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '12px',
                  }}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  formatter={(value: number) => [formatNumber(value), 'Requests']}
                />
                <Bar dataKey="requestCount" radius={[3, 3, 0, 0]} maxBarSize={32}>
                  {usage.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === usage.length - 1 ? '#4f46e5' : '#c7d2fe'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Quick start */}
      <Card>
        <CardHeader>
          <CardTitle>Quick start</CardTitle>
          <CardDescription>Make your first API request</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              1. Copy your API key from the Account page, then:
            </p>
            <div className="relative overflow-hidden rounded-lg bg-slate-900">
              <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-slate-200 font-mono">
                {CODE_SNIPPET}
              </pre>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-700 mb-2">Query parameters</p>
            <div className="space-y-1.5 font-mono text-xs text-slate-600">
              <div><span className="text-brand-600">year</span> — Model year (1980–2035)</div>
              <div><span className="text-brand-600">make</span> — Vehicle make (e.g. Toyota)</div>
              <div><span className="text-brand-600">model</span> — Vehicle model (e.g. Camry)</div>
              <div><span className="text-brand-600">submodel</span> — Optional trim level</div>
            </div>
          </div>

          <a
            href="http://localhost:8080/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            View full API documentation →
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
