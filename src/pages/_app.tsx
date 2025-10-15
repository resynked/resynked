import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import '../styles/globals.css';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/Toast';
import { ConfirmProvider } from '@/hooks/useConfirm';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <ToastProvider>
        <ConfirmProvider>
          <div className={inter.variable}>
            <Component {...pageProps} />
          </div>
        </ConfirmProvider>
      </ToastProvider>
    </SessionProvider>
  );
}