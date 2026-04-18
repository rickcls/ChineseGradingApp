type RevisionComparisonProps = {
  beforeText: string;
  afterText: string;
  priorities: string[];
  createdAt: Date;
  changedEvidenceCount: number;
  totalEvidenceCount: number;
  beforeChars: number;
  afterChars: number;
  changedEvidence: { id: string; evidenceSpan: string; suggestion: string }[];
  remainingEvidence: { id: string; evidenceSpan: string; suggestion: string }[];
};

export function RevisionComparison({
  beforeText,
  afterText,
  priorities,
  createdAt,
  changedEvidenceCount,
  totalEvidenceCount,
  beforeChars,
  afterChars,
  changedEvidence,
  remainingEvidence,
}: RevisionComparisonProps) {
  const delta = afterChars - beforeChars;
  const ratioLabel = totalEvidenceCount === 0 ? "已完成一次完整修訂" : `${changedEvidenceCount} / ${totalEvidenceCount} 處原句片段已有改動`;

  return (
    <div className="space-y-6">
      <section className="paper-panel-strong p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="section-kicker">前後對照</p>
            <div>
              <h1 className="text-3xl">這次修改，哪裡已經更清楚了？</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/75">
                這裡不是重新打分，而是幫你看見自己已經動手調整的地方。一次改好一兩項，已經很有價值。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-ink/75">
            <span className="pill">修訂時間 {createdAt.toLocaleDateString("zh-HK")}</span>
            <span className="pill pill-positive">{ratioLabel}</span>
            <span className="pill pill-warm">
              字數 {delta >= 0 ? "+" : ""}
              {delta}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="paper-panel p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">修改前</p>
              <h2 className="mt-1 text-xl">原文</h2>
            </div>
            <span className="pill">{beforeChars} 字</span>
          </div>
          <div className="prose-zh whitespace-pre-wrap rounded-[1.15rem] bg-paper/80 p-4 text-ink/90">
            {beforeText}
          </div>
        </div>

        <div className="paper-panel p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">修改後</p>
              <h2 className="mt-1 text-xl">你的新版本</h2>
            </div>
            <span className="pill pill-positive">{afterChars} 字</span>
          </div>
          <div className="prose-zh whitespace-pre-wrap rounded-[1.15rem] bg-white p-4 text-ink/90">
            {afterText}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="paper-panel p-5">
          <p className="section-kicker">這次專注的方向</p>
          <h2 className="mt-2 text-xl">修改提醒</h2>
          <ul className="mt-4 space-y-3">
            {priorities.map((priority, index) => (
              <li key={`${priority}-${index}`} className="rounded-2xl border border-border/70 bg-white/75 px-4 py-3 text-sm leading-7 text-ink/80">
                {priority}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="paper-panel p-5">
            <p className="section-kicker">你已經動手的地方</p>
            <h2 className="mt-2 text-xl">看起來已改寫的原句</h2>
            <ul className="mt-4 space-y-3">
              {changedEvidence.length === 0 ? (
                <li className="rounded-2xl border border-border/70 bg-white/75 px-4 py-3 text-sm leading-7 text-muted">
                  還看不出明顯改動，沒關係，可以先從一段最想修好的地方開始。
                </li>
              ) : (
                changedEvidence.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-good/20 bg-good/10 px-4 py-3 text-sm leading-7 text-ink/80">
                    <div className="font-medium text-ink">「{item.evidenceSpan}」</div>
                    <div className="mt-1 text-muted">{item.suggestion}</div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="paper-panel-muted p-5">
            <p className="section-kicker">下一輪可以再看看</p>
            <h2 className="mt-2 text-xl">似乎仍保留在文中的片段</h2>
            <ul className="mt-4 space-y-3">
              {remainingEvidence.length === 0 ? (
                <li className="rounded-2xl border border-border/70 bg-white/75 px-4 py-3 text-sm leading-7 text-muted">
                  這一輪你已經把原來被標出的片段都改動過了，做得很好。
                </li>
              ) : (
                remainingEvidence.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm leading-7 text-ink/80">
                    <div className="font-medium text-ink">「{item.evidenceSpan}」</div>
                    <div className="mt-1 text-muted">{item.suggestion}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
