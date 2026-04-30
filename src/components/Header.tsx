"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, SignInButton, useAuth, useUser } from "@clerk/nextjs";

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

const STUDENT_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "主頁" },
  { href: "/submissions/new", label: "新作提交", exact: true },
  { href: "/submissions", label: "作品紀錄" },
  { href: "/notebook", label: "學習筆記" },
  { href: "/weaknesses", label: "能力地圖" },
];

const TEACHER_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "主頁" },
  { href: "/teacher/dashboard", label: "學生作品" },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "主頁" },
  { href: "/admin/dashboard", label: "用戶管理" },
  { href: "/student/dashboard", label: "學生主頁" },
  { href: "/submissions/new", label: "新作提交", exact: true },
  { href: "/submissions", label: "作品紀錄" },
  { href: "/notebook", label: "學習筆記" },
  { href: "/weaknesses", label: "能力地圖" },
  { href: "/teacher/dashboard", label: "教師檢視" },
];

export function Header() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const role = roleFromMetadata(user?.publicMetadata);
  const navItems = role === "admin" ? ADMIN_NAV_ITEMS : role === "teacher" ? TEACHER_NAV_ITEMS : STUDENT_NAV_ITEMS;

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  function handleNavClick(event: MouseEvent<HTMLAnchorElement>, href: string, active: boolean) {
    if (
      active ||
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    setPendingHref(href);
  }

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

          <div className="flex items-center gap-3">
            <nav className="flex flex-wrap gap-2 text-sm">
              {navItems.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : item.exact
                      ? pathname === item.href
                      : item.href === "/submissions"
                        ? pathname === "/submissions" || (pathname.startsWith("/submissions/") && !pathname.startsWith("/submissions/new"))
                        : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-busy={pendingHref === item.href}
                    onClick={(event) => handleNavClick(event, item.href, active)}
                    className={[
                      "nav-pill",
                      pendingHref === item.href
                        ? "nav-pill-pending"
                        : active
                          ? "nav-pill-active"
                          : "nav-pill-idle",
                    ].join(" ")}
                  >
                    {pendingHref === item.href ? <span aria-hidden="true" className="pending-spinner" /> : null}
                    <span>{pendingHref === item.href ? "載入中…" : item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {!isLoaded ? null : isSignedIn ? (
              <UserButton />
            ) : (
              <SignInButton mode="redirect">
                <button className="btn-secondary px-4 py-2">
                  登入
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function roleFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "student";
  const role = (metadata as Record<string, unknown>).role;
  return role === "admin" || role === "teacher" || role === "student" ? role : "student";
}
