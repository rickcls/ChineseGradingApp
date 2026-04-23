type CoachCardProps = {
  id?: string;
  children: React.ReactNode;
  title?: string;
  eyebrow?: string;
  tone?: "default" | "primary" | "positive" | "warm" | "muted";
  className?: string;
};

const toneClasses: Record<NonNullable<CoachCardProps["tone"]>, string> = {
  default: "border-border/80 bg-white/80",
  primary: "border-accent/20 bg-accent/5",
  positive: "border-good/20 bg-good/10",
  warm: "border-coral/20 bg-coral/10",
  muted: "border-border/70 bg-cream/80",
};

export function CoachCard({
  id,
  children,
  title,
  eyebrow,
  tone = "default",
  className,
}: CoachCardProps) {
  return (
    <div id={id} className={["paper-panel p-5 scroll-mt-32", toneClasses[tone], className].filter(Boolean).join(" ")}>
      {eyebrow ? <p className="section-kicker mb-2">{eyebrow}</p> : null}
      {title ? <h3 className="mb-3 text-lg">{title}</h3> : null}
      <div className="text-sm leading-7 text-ink/90">{children}</div>
    </div>
  );
}
