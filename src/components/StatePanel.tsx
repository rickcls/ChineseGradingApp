type StateKind = "loading" | "empty" | "error";

type StatePanelProps = {
  state: StateKind;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  action?: React.ReactNode;
  className?: string;
};

const toneClasses: Record<StateKind, string> = {
  loading: "border-accent/20 bg-accent/5",
  empty: "border-border/80 bg-white/70",
  error: "border-coral/25 bg-coral/10",
};

export function StatePanel({
  state,
  title,
  description,
  actionHref,
  actionLabel,
  action,
  className,
}: StatePanelProps) {
  return (
    <div className={["paper-panel p-6 sm:p-7", toneClasses[state], className].filter(Boolean).join(" ")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-accent shadow-sm">
            <StateIcon state={state} />
          </div>
          <div className="space-y-2">
            <p className="section-kicker">
              {state === "loading" ? "導師正在整理" : state === "empty" ? "還在累積中" : "先別擔心"}
            </p>
            <div>
              <h2 className="text-xl">{title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/75">{description}</p>
            </div>
          </div>
        </div>
        {action ? (
          <div className="shrink-0">{action}</div>
        ) : actionHref && actionLabel ? (
          <a href={actionHref} className="btn-secondary shrink-0">
            {actionLabel}
          </a>
        ) : null}
      </div>
      {state === "loading" ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="rounded-2xl border border-white/80 bg-white/70 p-4">
              <div className="h-2.5 w-24 animate-pulse rounded-full bg-accent/20" />
              <div className="mt-3 h-2.5 w-full animate-pulse rounded-full bg-accent/10" />
              <div className="mt-2 h-2.5 w-4/5 animate-pulse rounded-full bg-accent/10" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StateIcon({ state }: { state: StateKind }) {
  if (state === "loading") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="animate-spin">
        <path
          d="M12 3a9 9 0 1 1-6.36 2.64"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (state === "error") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 8v4m0 4h.01M10.14 3.86 2.86 11.14a2 2 0 0 0 0 2.83l7.28 7.28a2 2 0 0 0 2.83 0l7.28-7.28a2 2 0 0 0 0-2.83l-7.28-7.28a2 2 0 0 0-2.83 0Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 8h12M6 12h8m-8 4h10M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-13Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
