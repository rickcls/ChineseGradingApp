export function CoachCard({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
      {title ? <h3 className="mb-2 font-serif text-lg">{title}</h3> : null}
      <div className="text-sm text-ink/90">{children}</div>
    </div>
  );
}
