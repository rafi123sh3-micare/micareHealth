'use client';

import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { LoadingProvider } from '@/context/LoadingContext';
import { Toaster } from 'react-hot-toast';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#0ea5e9" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Clinic Connect" />
        <link rel="manifest" href="/manifest.json" />
        <title>Clinic Connect</title>
      </head>
      <body className="bg-gray-50 min-h-screen flex flex-col">
        <AuthProvider>
          <LoadingProvider>
            {children}
            <Toaster position="top-center" containerStyle={{ zIndex: 99999 }} />
          </LoadingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
