import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'B-Invest Admin',
  description: 'Panel administrateur B-Invest Limited',
  robots: 'noindex, nofollow',
  icons: {
    icon: '/logo-binvest.jpg',
    apple: '/logo-binvest.jpg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, fontFamily: 'Outfit, sans-serif' }}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              fontFamily: 'Outfit, sans-serif',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            },
            success: { style: { background: '#16a34a', color: '#fff' } },
            error:   { style: { background: '#E63946', color: '#fff' } },
          }}
        />
      </body>
    </html>
  );
}
