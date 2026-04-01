import Link from 'next/link';
import Image from 'next/image';
import { AuthProvider } from '@/contexts/auth';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <nav className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
            <Link href="/">
              <Image src="/logo.png" alt="VINstub" width={120} height={39} priority />
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
