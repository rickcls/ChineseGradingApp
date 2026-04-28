"use client";

import { usePathname } from "next/navigation";
import { Header } from "./Header";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isAuthRoute =
    pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  if (isAuthRoute) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6">
        <div className="paper-panel flex flex-col gap-3 px-5 py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>導師提示：進步比分數更重要。每次只專注 1–2 項重點即可。</p>
          <p className="text-xs uppercase tracking-[0.24em] text-accent/70">
            Warm feedback, steady growth.
          </p>
        </div>
      </footer>
    </>
  );
}
