import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Terminal, Database } from "lucide-react";

export const metadata: Metadata = {
  title: "운영 일지 시스템 | Operations Journal",
  description: "계층형 인프라 및 서비스 운영 일지 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 antialiased">
        {/* Clean Enterprise Top Navigation */}
        <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#0c101b]/90 backdrop-blur-md">
          <div className="w-full px-5 h-13 flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/reports" className="flex items-center space-x-2.5 group">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                  <Terminal className="w-4 h-4" />
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="font-semibold text-sm tracking-tight text-white">
                    운영 일지
                  </span>
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Operations
                  </span>
                </div>
              </Link>

              <nav className="flex items-center space-x-1">
                <Link
                  href="/reports"
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  일지 목록
                </Link>
              </nav>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span className="text-[11px] font-mono text-slate-400">PostgreSQL</span>
              </div>
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                <span className="text-[11px] font-mono text-slate-400">API 8000</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
