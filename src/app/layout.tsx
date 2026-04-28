import type { Metadata } from "next";
import "./globals.css";
import { AppFrame } from "@/components/AppFrame";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "AI Chinese Learning Coach",
  description: "溫和、具體、以成長為中心的中文寫作導師介面。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="zh-HK">
        <body className="min-h-screen bg-paper text-ink antialiased">
          <AppFrame>{children}</AppFrame>
        </body>
      </html>
    </ClerkProvider>
  );
}
