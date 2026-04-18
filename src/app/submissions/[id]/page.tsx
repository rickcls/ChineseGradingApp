import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { AnnotatedText } from "@/components/AnnotatedText";
import { CoachCard } from "@/components/CoachCard";
import { RevisionComposer } from "@/components/RevisionComposer";
import { StatePanel } from "@/components/StatePanel";
import { StreamingText } from "@/components/StreamingText";
import { DEFAULT_WRITING_RUBRIC } from "@/lib/rubric";

export const dynamic = "force-dynamic";

export default async function SubmissionDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const submission = await prisma.submission.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      errors: { orderBy: { charOffsetStart: "asc" } },
      revisionOrigin: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!submission) notFound();

  const analysis = submission.analyses[0];
  const latestRevision = submission.revisionOrigin[0] || null;

  if (!analysis) {
    const isFailed = submission.status === "failed";
    return (
      <div className="space-y-4">
        <BackLink />
        <StatePanel
          state={isFailed ? "error" : "loading"}
          title={isFailed ? "這篇文章暫時未能完成分析" : "導師仍在閱讀這篇文章"}
          description={
            isFailed
              ? "這次分析沒有順利完成，可能是網路或模型回應不穩。文章本身沒有問題，你可以稍後重新提交。"
              : "回饋會分段整理，不會突然整塊跳出。稍等一下，我正在把重點和證據排好。"
          }
          actionHref={isFailed ? "/submissions/new" : undefined}
          actionLabel={isFailed ? "重新提交一篇" : undefined}
        />
      </div>
    );
  }

  const scores = analysis.scores as Record<string, number>;
  const strengths = analysis.strengths as string[];
  const priorities = analysis.revisionPriorities as string[];

  const errorsByCategory = new Map<string, typeof submission.errors>();
  for (const error of submission.errors) {
    const list = errorsByCategory.get(error.category) || [];
    list.push(error);
    errorsByCategory.set(error.category, list);
  }

  return (
    <div className="space-y-8">
      <BackLink />

      <section className="paper-panel-strong p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className={submission.source === "typed" ? "pill" : "pill pill-warm"}>
                {sourceLabel(submission.source)}
              </span>
              {latestRevision ? (
                <Link href={`/submissions/${submission.id}/compare`} className="pill pill-positive">
                  已有修訂對照
                </Link>
              ) : null}
            </div>
            <div>
              <p className="section-kicker">導師回饋</p>
              <h1 className="mt-2 text-3xl sm:text-4xl">先看亮點，再一起挑 2–3 個最值得修改的地方</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/75">
                每一條建議都會對應到原文中的證據片段。你不需要一次全改完，只要先處理最影響清晰度的部分就很好。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[22rem] lg:grid-cols-1 xl:grid-cols-3">
            <ScoreStat label="整體分數" value={analysis.overallScore.toFixed(0)} tone="primary" />
            <ScoreStat label="亮點" value={`${strengths.length}`} tone="positive" />
            <ScoreStat label="標註處" value={`${submission.errors.length}`} tone="warm" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <CoachCard title="導師先跟你說" eyebrow="鼓勵式回饋" tone="primary" className="p-6 sm:p-7">
          <StreamingText text={analysis.coachFeedbackText} />
        </CoachCard>

        <div className="grid gap-4">
          <CoachCard title="這次做得好的地方" eyebrow="值得保留的亮點" tone="positive">
            {strengths.length === 0 ? (
              <p className="text-muted">這次沒有特別記錄亮點，但願意交稿本身就是很重要的一步。</p>
            ) : (
              <ul className="space-y-3">
                {strengths.map((strength, index) => (
                  <li key={`${strength}-${index}`} className="rounded-2xl border border-good/20 bg-white/75 px-4 py-3">
                    {strength}
                  </li>
                ))}
              </ul>
            )}
          </CoachCard>

          <CoachCard title="下一步先改什麼" eyebrow="成長邊緣" tone="warm">
            <ol className="space-y-3">
              {priorities.map((priority, index) => (
                <li key={`${priority}-${index}`} className="rounded-2xl border border-coral/20 bg-white/75 px-4 py-3">
                  {index + 1}. {priority}
                </li>
              ))}
            </ol>
          </CoachCard>
        </div>
      </section>

      <CoachCard title="五項能力觀察" eyebrow="不是分數機，而是能力輪廓" className="p-6">
        <ul className="grid gap-4 md:grid-cols-2">
          {DEFAULT_WRITING_RUBRIC.criteria.map((criterion) => {
            const value = Number(scores[criterion.key] ?? 0);
            const pct = Math.round((value / criterion.maxScore) * 100);
            return (
              <li key={criterion.key} className="rounded-[1.15rem] border border-border/70 bg-white/75 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-ink">{criterion.label}</span>
                  <span className="text-sm text-ink/70">
                    {value.toFixed(0)} / {criterion.maxScore}
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-accent/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent to-good" style={{ width: `${Math.max(12, pct)}%` }} />
                </div>
                <p className="mt-3 text-xs leading-6 text-muted">{descriptorForScore(criterion, value)}</p>
              </li>
            );
          })}
        </ul>
      </CoachCard>

      <section className="space-y-4">
        <div>
          <p className="section-kicker">文中批註</p>
          <h2 className="mt-2 text-2xl">點讀原文，看看導師在意的是哪一句</h2>
        </div>
        <AnnotatedText
          text={submission.verifiedText}
          errors={submission.errors.map((error) => ({
            id: error.id,
            category: error.category,
            subcategory: error.subcategory,
            charOffsetStart: error.charOffsetStart,
            charOffsetEnd: error.charOffsetEnd,
            severity: error.severity,
            suggestion: error.suggestion,
            ocrSuspect: error.ocrSuspect,
          }))}
        />
      </section>

      <RevisionComposer
        submissionId={submission.id}
        originalText={submission.verifiedText}
        priorities={priorities}
        hasExistingRevision={Boolean(latestRevision)}
      />

      <section className="space-y-4">
        <div>
          <p className="section-kicker">分類整理</p>
          <h2 className="mt-2 text-2xl">把提醒分門別類，更容易決定先改哪裡</h2>
        </div>

        {submission.errors.length === 0 ? (
          <StatePanel
            state="empty"
            title="這篇沒有發現明顯錯誤"
            description="很不錯。接下來可以把重心放在內容更具體、表達更有層次，而不是只盯著找錯字。"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from(errorsByCategory.entries()).map(([category, list]) => (
              <CoachCard
                key={category}
                title={`${category}・${list.length} 處`}
                eyebrow="證據與下一步"
                tone={category === "內容" || category === "結構" ? "warm" : "default"}
              >
                <ul className="space-y-3">
                  {list.map((error) => (
                    <li key={error.id} className="rounded-2xl border border-border/70 bg-white/80 px-4 py-3">
                      <div className="text-xs text-muted">{error.subcategory}</div>
                      <div className="mt-1 font-serif text-base text-ink">「{error.evidenceSpan}」</div>
                      <div className="mt-2 text-sm leading-7 text-ink/80">{error.suggestion}</div>
                    </li>
                  ))}
                </ul>
              </CoachCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ScoreStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "positive" | "warm";
}) {
  const toneClass =
    tone === "primary"
      ? "border-accent/20 bg-accent/5"
      : tone === "positive"
        ? "border-good/20 bg-good/10"
        : "border-coral/20 bg-coral/10";

  return (
    <div className={["rounded-[1.15rem] border px-4 py-4 shadow-soft", toneClass].join(" ")}>
      <div className="text-xs uppercase tracking-[0.22em] text-muted">{label}</div>
      <div className="mt-2 font-serif text-3xl text-ink">{value}</div>
    </div>
  );
}

function sourceLabel(source: string) {
  if (source === "photo") return "拍照交稿";
  if (source === "scan") return "掃描稿";
  return "直接輸入";
}

function descriptorForScore(
  criterion: (typeof DEFAULT_WRITING_RUBRIC.criteria)[number],
  value: number,
) {
  const descriptor = criterion.descriptors.find(
    (item) => value >= item.range[0] && value <= item.range[1],
  );
  return descriptor?.description || "這一項仍在整理中。";
}

function BackLink() {
  return (
    <Link href="/" className="btn-secondary inline-flex">
      返回主頁
    </Link>
  );
}
