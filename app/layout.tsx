import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthGuard } from '@/components/AuthGuard';
import { DailyAutomation } from '@/components/DailyAutomation';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CorçaCRM — Inteligência Comercial B2B',
  description: 'CRM B2B completo para gestão de leads, funil de vendas e inteligência comercial.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('corca-theme');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <AuthGuard>
          <DailyAutomation />
          {children}
        </AuthGuard>
      </body>
    </html>
  );
}