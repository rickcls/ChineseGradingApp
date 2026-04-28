import Link from "next/link";
import type { ReactNode } from "react";

type Highlight = {
  label: string;
  hint: string;
};

type AuthShellProps = {
  kicker: string;
  title: string;
  description: string;
  highlights: Highlight[];
  footerLabel: string;
  footerHref: string;
  footerLinkLabel: string;
  children: ReactNode;
};

export function AuthShell({
  kicker,
  title,
  description,
  highlights,
  footerLabel,
  footerHref,
  footerLinkLabel,
  children,
}: AuthShellProps) {
  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 sm:py-10 lg:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <Link href="/" className="flex items-center gap-3 self-start">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
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

        <div className="grid gap-8 lg:grid-cols-[minmax(420px,460px)_minmax(0,1fr)] lg:items-start">
          <section className="flex flex-col items-center gap-5">
            <div className="w-full">{children}</div>

            <div className="text-center text-sm text-muted">
              <span>{footerLabel} </span>
              <Link
                href={footerHref}
                className="font-medium text-accent transition hover:text-accent/80"
              >
                {footerLinkLabel}
              </Link>
            </div>
          </section>

          <section className="paper-panel-strong relative overflow-hidden p-7 sm:p-9">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-coral/10 blur-3xl" />

            <div className="relative space-y-6">
              <p className="section-kicker">{kicker}</p>

              <div>
                <h1 className="text-3xl leading-snug text-ink sm:text-4xl">{title}</h1>
                <p className="mt-4 max-w-md text-sm leading-7 text-ink/75">{description}</p>
              </div>

              <ul className="space-y-3">
                {highlights.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-start gap-3 rounded-2xl border border-border/60 bg-white/70 px-4 py-3"
                  >
                    <span className="mt-1 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent/10 text-accent">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="m5 12.5 4 4 10-10"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <div>
                      <div className="text-sm font-medium text-ink">{item.label}</div>
                      <div className="text-xs leading-6 text-muted">{item.hint}</div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="rounded-2xl border border-border/60 bg-cream/70 px-4 py-4 text-xs leading-6 text-muted">
                導師提示：進步比分數更重要。每次只專注 1–2 項重點即可。
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
