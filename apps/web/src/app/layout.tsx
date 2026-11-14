import './globals.css';
import { Navigation } from '../components/Navigation';

export const metadata = {
  title: 'Link Hunter — Research Intelligence',
  description: 'A multi-source trading community research workspace with explainable verification and provenance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col antialiased">
        <Navigation />
        <main className="app-workspace flex-1 w-full max-w-[1420px] mx-auto px-4 sm:px-7 xl:px-10 py-8 md:py-11">{children}</main>
        <footer className="border-t border-[#253243] py-5 px-6">
          <div className="max-w-[1420px] mx-auto flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#869caf]">
            <span className="font-medium tracking-[.12em] uppercase">Link Hunter / Research Intelligence</span>
            <span>Public-source discovery · Evidence-led scoring · v2.1</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
