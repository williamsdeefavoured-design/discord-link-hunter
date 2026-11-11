import './globals.css';
import { Navigation } from '../components/Navigation';

export const metadata = {
  title: 'Discord Link Hunter | AI-Ready Trading Community Discovery',
  description: 'Multilingual research and Discord community discovery platform for trading and financial education.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased flex flex-col">
        <Navigation />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
        <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
          Discord Link Hunter v2.1 • Safe Multilingual Discovery Engine
        </footer>
      </body>
    </html>
  );
}

