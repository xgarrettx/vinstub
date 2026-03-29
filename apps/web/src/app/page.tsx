import Link from 'next/link';
import { Check, Zap, Shield, BarChart3, ArrowRight, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For testing and side projects.',
    badge: null,
    limits: { daily: '50 lookups/day', rate: '5/min · 30/hr', concurrency: '1 concurrent' },
    features: ['Full API access', 'All makes & models', 'JSON responses', 'Community support'],
    cta: 'Get started free',
    ctaHref: '/register',
    variant: 'outline' as const,
    highlight: false,
  },
  {
    name: 'Basic',
    price: '$7.99',
    period: '/month',
    description: 'For small production apps.',
    badge: null,
    limits: { daily: '500 lookups/day', rate: '20/min · 200/hr', concurrency: '3 concurrent' },
    features: ['Everything in Free', 'Soft daily cap (no hard blocks)', 'Email support', 'Usage dashboard'],
    cta: 'Start Basic',
    ctaHref: '/register',
    variant: 'outline' as const,
    highlight: false,
  },
  {
    name: 'Premium',
    price: '$19.99',
    period: '/month',
    description: 'For growing platforms.',
    badge: 'Most popular',
    limits: { daily: '5,000 lookups/day', rate: '100/min · 2,000/hr', concurrency: '10 concurrent' },
    features: ['Everything in Basic', 'Priority email support', 'Usage analytics', 'Key rotation'],
    cta: 'Start Premium',
    ctaHref: '/register',
    variant: 'default' as const,
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '$99',
    period: '/month',
    description: 'For high-volume production.',
    badge: null,
    limits: { daily: '50,000 lookups/day', rate: '500/min · 15,000/hr', concurrency: '25 concurrent' },
    features: ['Everything in Premium', 'Dedicated support', 'SLA uptime guarantee', 'Custom integrations'],
    cta: 'Start Enterprise',
    ctaHref: '/register',
    variant: 'outline' as const,
    highlight: false,
  },
];

const CODE_EXAMPLE = `curl "https://api.vinstub.com/v1/stub?year=2020&make=Toyota&model=Camry&submodel=LE%204dr%20Sedan" \\
  -H "Authorization: Bearer vs_live_..."

{
  "success": true,
  "data": {
    "vin_stub": "4T1C11AKLU",
    "stub_length": 10,
    "year": 2020,
    "make": "Toyota",
    "model": "Camry",
    "submodel": "LE 4dr Sedan",
    "match_type": "exact"
  }
}`;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <span className="font-display text-xs font-bold">VS</span>
            </div>
            <span className="font-display text-lg font-semibold text-slate-900">VINSTUB</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white py-24 sm:py-32">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f020_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f020_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <Badge variant="default" className="mb-6 inline-flex">
            <Zap className="h-3 w-3" />
            VIN stub lookups in milliseconds
          </Badge>
          <h1 className="font-display text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl text-balance">
            The fastest way to look up{' '}
            <span className="text-brand-600">VIN stubs</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 text-balance">
            Instant WMI + VDS prefix lookups by year, make, model, and submodel.
            Production-ready JSON API for vehicle data enrichment, VIN generation, and automotive platforms.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                Start for free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#pricing">
              <Button size="lg" variant="outline">View pricing</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Code preview */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-400" />
              <div className="h-3 w-3 rounded-full bg-amber-400" />
              <div className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-2 font-mono text-xs text-slate-500">Terminal</span>
            </div>
            <pre className="overflow-x-auto bg-slate-900 p-6 text-sm">
              <code className="font-mono text-slate-200 leading-relaxed whitespace-pre">
                {CODE_EXAMPLE}
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">
              Built for developers
            </h2>
            <p className="mt-4 text-slate-600">Everything you need to integrate VIN data into your application.</p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {[
              {
                icon: Zap,
                title: 'Blazing fast',
                desc: 'Redis-cached responses for reference data. Sub-10ms p99 for common lookups.',
              },
              {
                icon: Shield,
                title: 'Reliable & secure',
                desc: 'Bearer token auth, rate limiting, and per-key usage tracking built in.',
              },
              {
                icon: BarChart3,
                title: 'Usage insights',
                desc: 'Per-day usage dashboard. Know exactly how your quota is being used.',
              },
              {
                icon: Code2,
                title: 'Simple JSON API',
                desc: 'Consistent response envelope. Integrate in minutes with any language.',
              },
              {
                icon: Check,
                title: 'Exact & fuzzy matching',
                desc: 'Exact submodel match with automatic fallback to base model WMI.',
              },
              {
                icon: Shield,
                title: 'Soft daily caps',
                desc: 'Paid plans never hard-block at quota. Get a flag, not an error.',
              },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                  <f.icon className="h-5 w-5 text-brand-600" />
                </div>
                <h3 className="font-display text-base font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-24 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-slate-600">Start free. Upgrade as you grow. No surprises.</p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  plan.highlight
                    ? 'border-brand-600 bg-brand-600 text-white shadow-xl shadow-brand-600/20'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-brand-600 px-3 py-0.5 text-xs font-medium text-white shadow">
                      {plan.badge}
                    </span>
                  </div>
                )}
                <div>
                  <p className={`text-sm font-medium ${plan.highlight ? 'text-brand-200' : 'text-slate-500'}`}>
                    {plan.name}
                  </p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className={`font-display text-3xl font-bold ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>
                      {plan.price}
                    </span>
                    <span className={`text-sm ${plan.highlight ? 'text-brand-200' : 'text-slate-500'}`}>
                      {plan.period}
                    </span>
                  </div>
                  <p className={`mt-2 text-sm ${plan.highlight ? 'text-brand-100' : 'text-slate-600'}`}>
                    {plan.description}
                  </p>
                </div>

                <div className={`mt-4 space-y-1.5 rounded-lg p-3 text-xs font-mono ${plan.highlight ? 'bg-brand-700' : 'bg-slate-50'}`}>
                  <div className={plan.highlight ? 'text-brand-200' : 'text-slate-600'}>{plan.limits.daily}</div>
                  <div className={plan.highlight ? 'text-brand-200' : 'text-slate-600'}>{plan.limits.rate}</div>
                  <div className={plan.highlight ? 'text-brand-200' : 'text-slate-600'}>{plan.limits.concurrency}</div>
                </div>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlight ? 'text-brand-300' : 'text-brand-600'}`} />
                      <span className={`text-sm ${plan.highlight ? 'text-brand-100' : 'text-slate-600'}`}>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  <Link href={plan.ctaHref} className="block">
                    <button
                      className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                        plan.highlight
                          ? 'bg-white text-brand-600 hover:bg-brand-50'
                          : 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {plan.cta}
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">
            Ready to integrate?
          </h2>
          <p className="mt-4 text-slate-600">
            Sign up in 30 seconds. Get your API key instantly on email verification.
          </p>
          <div className="mt-8">
            <Link href="/register">
              <Button size="lg">
                Create free account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-brand-600 text-white">
              <span className="font-display text-[9px] font-bold">VS</span>
            </div>
            <span>© {new Date().getFullYear()} VINSTUB.com</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/docs" className="hover:text-slate-900 transition-colors">Docs</Link>
            <Link href="/login" className="hover:text-slate-900 transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-slate-900 transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
