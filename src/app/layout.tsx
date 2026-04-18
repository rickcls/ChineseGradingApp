import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "AI 中文寫作導師",
  description: "鼓勵式、以證據為本的中文寫作回饋。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-HK">
      <body className="min-h-screen bg-paper text-ink">
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-10 text-xs text-muted">
          導師提示：進步比分數更重要。每次只專注 1–2 項重點即可。
        </footer>
      </body>
    </html>
  );
}
