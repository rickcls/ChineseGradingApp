"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "主頁" },
  { href: "/submissions/new", label: "新作提交" },
  { href: "/weaknesses", label: "能力地圖" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <div className="paper-panel-strong flex flex-col gap-4 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5.5 18.5c4.3 0 7.78-3.48 7.78-7.78V5.5C9 5.5 5.5 9 5.5 13.34v5.16Zm7.78 0H18.5M13.28 10.72h5.22"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-accent/70">
                AI Chinese Learning Coach
              </p>
              <div className="calligraphy-accent mt-1">
                <span className="text-xl text-ink">AI 中文學習導師</span>
              </div>
            </div>
          </Link>

          <nav className="flex flex-wrap gap-2 text-sm">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "rounded-full px-4 py-2 transition",
                    active
                      ? "bg-accent text-white shadow-soft"
                      : "border border-border/70 bg-white/80 text-ink/75 hover:border-accent/30 hover:text-accent",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
