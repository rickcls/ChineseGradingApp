"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GradeComparison } from "@/lib/regradeCompare";

type RegradePanelProps = {
  submissionId: string;
  comparison: GradeComparison | null;
  result: { coachFeedback: string; priorities: { focus?: string; issue: string }[]; gradedAt: string } | null;
  canRegrade: boolean;
  creditsLabel: string;
  hasCredits: boolean;
};

const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;

export function RegradePanel({ submissionId, comparison, result, canRegrade, creditsLabel, hasCredits }: RegradePanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/submissions/${submissionId}/revision/regrade`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) throw new Error(typeof body?.error === "string" ? body.error : "重新評分暫時未能完成，請稍後再試。");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "重新評分暫時未能完成，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  if (!comparison || !result) {
    return (
      <section className="paper-panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-kicker">重新評分修訂稿</p>
            <h2 className="mt-1 text-xl">改完了？看看等級有沒有變化</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/75">
              用同一套 HKDSE 準則再評一次你的新版本，並與原稿逐項比較。需要 1 點（{creditsLabel}）；評分失敗會自動退回點數。
            </p>
          </div>
          <button
            type="button"
            onClick={regrade}
            disabled={!canRegrade || !hasCredits || loading}
            aria-busy={loading}
            className="btn-primary min-w-[10rem]"
          >
            <span className="inline-flex items-center gap-2">
              {loading ? <span aria-hidden="true" className="pending-spinner" /> : null}
              <span>{loading ? "評分中…（約 20–60 秒）" : hasCredits ? "重新評分（1 點）" : "沒有可用點數"}</span>
            </span>
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
      </section>
    );
  }

  const levelTone =
    comparison.levelChange > 0 ? "border-good text-good" : comparison.levelChange < 0 ? "border-coral text-coral" : "border-border text-ink";

  return (
    <section className="paper-panel p-5 sm:p-6">
      <p className="section-kicker">重新評分結果</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className={["flex items-center gap-3 rounded-[1rem] border-2 px-4 py-3", levelTone].join(" ")}>
          <span className="font-serif text-2xl">L{comparison.levelBefore}</span>
          <span aria-hidden="true">→</span>
          <span className="font-serif text-3xl">L{comparison.levelAfter}</span>
        </div>
        <div className="text-sm text-ink/80">
          總分 {comparison.overallBefore.toFixed(0)} → {comparison.overallAfter.toFixed(0)}
          <span className="ml-1 font-medium">（{signed(Math.round(comparison.overallDelta))}）</span>
        </div>
      </div>
      {comparison.withinNoise ? (
        <p className="mt-3 rounded-[1rem] border border-border/70 bg-white/75 px-4 py-2 text-xs leading-6 text-muted">
          總分只相差 {Math.abs(Math.round(comparison.overallDelta))} 分，屬 AI 評分的正常波動，未必代表真正進步或退步；下面各項錯誤的變化更值得參考。
        </p>
      ) : null}

      <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {comparison.criteria.map((criterion) => (
          <li key={criterion.key} className="rounded-[1rem] border border-border/70 bg-white/75 px-4 py-3 text-sm">
            <div className="font-medium text-ink">{criterion.label}</div>
            <div className="mt-1 text-ink/80">
              {criterion.before} → {criterion.after} / {criterion.max}
              <span
                className={[
                  "ml-2 font-medium",
                  criterion.delta > 0 ? "text-good" : criterion.delta < 0 ? "text-coral" : "text-muted",
                ].join(" ")}
              >
                {signed(criterion.delta)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {comparison.issues.length > 0 ? (
        <div className="mt-5">
          <h3 className="font-medium text-ink">錯誤數量變化</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {comparison.issues.map((issue) => {
              const cleared = issue.before > 0 && issue.after === 0;
              const added = issue.before === 0 && issue.after > 0;
              return (
                <li
                  key={issue.label}
                  className={[
                    "flex items-center justify-between rounded-[0.9rem] border px-3 py-2 text-sm",
                    cleared ? "border-good/30 bg-good/10" : added ? "border-coral/30 bg-coral/10" : "border-border/70 bg-white/75",
                  ].join(" ")}
                >
                  <span className="text-ink/85">{issue.label}</span>
                  <span className="font-medium text-ink">
                    {issue.before} → {issue.after} {cleared ? "✓" : added ? "（新出現）" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="font-medium text-ink">導師對新版本的評語</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink/85">{result.coachFeedback}</p>
        </div>
        {result.priorities.length > 0 ? (
          <div>
            <h3 className="font-medium text-ink">下一輪最值得改</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-7 text-ink/85">
              {result.priorities.map((priority, index) => (
                <li key={`${priority.issue}-${index}`}>
                  {priority.focus ? `【${priority.focus}】` : ""}
                  {priority.issue}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-muted">
        評分時間：{new Date(result.gradedAt).toLocaleString("zh-HK")}。AI 估算，只供參考；想再評一次，請修改並儲存新版本。
      </p>
    </section>
  );
}
