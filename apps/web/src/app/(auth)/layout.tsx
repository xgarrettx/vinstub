import Link from 'next/link';
import { AuthProvider } from '@/contexts/auth';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <nav className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
                <span className="font-display text-xs font-bold">VS</span>
              </div>
              <span className="font-display text-base font-semibold text-slate-900">VINSTUB</span>
            </Link>
          </div>
        </nav>
        <div className="flex flex-1 items-center justify-center py-12 px-6">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
