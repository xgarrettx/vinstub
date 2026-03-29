import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'VINSTUB — VIN Stub Lookup API',
    template: '%s | VINSTUB',
  },
  description:
    'Instant VIN stub lookups by year, make, model, and submodel. Production-ready API for vehicle data enrichment.',
  keywords: ['VIN', 'VIN decoder', 'vehicle data', 'automotive API', 'WMI', 'VDS'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts loaded client-side to avoid build-time network requirement */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
