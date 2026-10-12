import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "운영 일지 | OpsJournal",
  description: "인프라 및 시스템 운영 계층 일지 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen flex flex-col bg-[#0b0d11] text-slate-100 antialiased selection:bg-blue-500/30 selection:text-white">
        {/* Clean, Minimal Top Header */}
        <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#0f1217]/90 backdrop-blur-md">
          <div className="w-full px-5 sm:px-8 h-13 flex items-center justify-between">
            {/* Left: Brand & Navigation */}
            <div className="flex items-center space-x-6">
              <Link href="/reports" className="flex items-center space-x-2.5 group">
                <div className="w-7 h-7 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:bg-blue-600/25 transition-colors">
                  <BookOpen className="w-3.5 h-3.5 stroke-[2.2]" />
                </div>
                <div className="flex items-baseline space-x-1.5">
                  <span className="font-bold text-sm tracking-tight text-white group-hover:text-blue-400 transition-colors">
                    OpsJournal
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    운영 일지
                  </span>
                </div>
              </Link>

              <div className="h-3.5 w-px bg-white/[0.08]" />

              <nav className="flex items-center space-x-1">
                <Link
                  href="/reports"
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  일지 목록
                </Link>
              </nav>
            </div>

            {/* Right: Clean & Minimal (Tacky fake profile removed) */}
            <div className="flex items-center space-x-3 text-xs text-slate-400">
              {/* Optional clean neutral badge or empty */}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
