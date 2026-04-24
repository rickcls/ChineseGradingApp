import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { AnnotatedText } from "@/components/AnnotatedText";
import { CoachCard } from "@/components/CoachCard";
import { ModelPassagePanel } from "@/components/ModelPassagePanel";
import { NotebookQuickPanel } from "@/components/NotebookQuickPanel";
import { RevisionComposer } from "@/components/RevisionComposer";
import { StatePanel } from "@/components/StatePanel";
import { StreamingText } from "@/components/StreamingText";
import { SubmissionSectionTabs } from "@/components/SubmissionSectionTabs";
import {
  DEFAULT_WRITING_RUBRIC,
  DseLevel,
  dseLevelFromScore,
  dseLevelNote,
  RECOMMENDED_WORD_COUNT,
  totalMaxScore,
} from "@/lib/rubric";
import { serializeModelPassage } from "@/lib/modelPassage";
import { serializeNotebookEntry } from "@/lib/notebook";
import { normalizeRevisionPriorities } from "@/lib/revisionPriority";
import { buildWorkbenchRevisionSuggestions } from "@/lib/revisionSuggestions";

export const dynamic = "force-dynamic";

export default async function SubmissionDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const [submission, recentNotebookEntries] = await Promise.all([
    prisma.submission.findFirst({
      where: { id: params.id, userId: user.id },
      include: {
        analyses: { orderBy: { createdAt: "desc" }, take: 1 },
        errors: { orderBy: { charOffsetStart: "asc" } },
        revisionOrigin: { orderBy: { createdAt: "desc" }, take: 1 },
        aiModelPassage: true,
      },
    }),
    prisma.notebookEntry.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 4,
      include: {
        submission: {
          select: {
            id: true,
            verifiedText: true,
          },
        },
      },
    }),
  ]);

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

  const scores = analysis.scores as Record<string, number | string>;
  const strengths = analysis.strengths as string[];
  const priorities = normalizeRevisionPriorities(analysis.revisionPriorities);
  const aiSuggestions = buildWorkbenchRevisionSuggestions({
    priorities,
    errors: submission.errors,
  });
  const rubricMax = totalMaxScore(DEFAULT_WRITING_RUBRIC);
  const baseScore = toNumber(scores.base_score, analysis.overallScore);
  const typoBonus = toNumber(scores.typo_bonus, Math.max(0, analysis.overallScore - baseScore));
  const typoCount = toNumber(scores.typo_count, 0);
  const wordCount = toNumber(scores.word_count, 0);
  const dseLevel: DseLevel =
    (typeof scores.dse_level === "string" ? (scores.dse_level as DseLevel) : undefined) ||
    dseLevelFromScore(baseScore);
  const wordCountShort = wordCount > 0 && wordCount < RECOMMENDED_WORD_COUNT;

  const errorsByCategory = new Map<string, typeof submission.errors>();
  for (const error of submission.errors) {
    const list = errorsByCategory.get(error.category) || [];
    list.push(error);
    errorsByCategory.set(error.category, list);
  }
  const pageSections = [
    { id: "feedback-summary", label: "導師回饋" },
    { id: "rubric-observations", label: "評分觀察" },
    ...(priorities.length > 0 ? [{ id: "revision-guide", label: "改寫指南" }] : []),
    { id: "annotations", label: "文中批註" },
    { id: "workbench", label: "訂正工作台" },
    { id: "model-passage", label: "AI 參考範文" },
    { id: "error-categories", label: "分類整理" },
  ];

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

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[22rem] lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-[1.15rem] border border-accent/30 bg-accent/10 px-4 py-4 shadow-soft">
              <div className="text-xs uppercase tracking-[0.22em] text-muted">HKDSE 水平</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-serif text-4xl text-ink">{dseLevel}</span>
                <span className="text-sm text-ink/70">
                  基本分 {baseScore.toFixed(0)} / {rubricMax}
                  {typoBonus > 0 ? ` · 錯別字 +${typoBonus}` : ""}
                </span>
              </div>
              <p className="mt-1 text-[0.68rem] text-muted">
                等級以基本分決定；錯別字獎勵只反映卷面整潔，不影響等級。
              </p>
              <p className="mt-2 text-xs leading-5 text-muted">{dseLevelNote(dseLevel)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ScoreStat label="亮點" value={`${strengths.length}`} tone="positive" />
              <ScoreStat label="標註處" value={`${submission.errors.length}`} tone="warm" />
              <ScoreStat label="字數" value={wordCount > 0 ? `${wordCount}` : "—"} tone="primary" />
              <ScoreStat label="錯別字" value={`${typoCount}`} tone="warm" />
            </div>
          </div>
        </div>
      </section>

      <SubmissionSectionTabs items={pageSections}>
        <section
          id="feedback-summary"
          data-section-id="feedback-summary"
          className="grid gap-4 scroll-mt-32 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
        >
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

            <CoachCard title="下一步改進重點" eyebrow={`共 ${priorities.length} 項，由影響力排序`} tone="warm">
              {priorities.length === 0 ? (
                <p className="text-muted">目前沒有明顯的改進重點。繼續保持下一篇的水準就好。</p>
              ) : (
                <ol className="space-y-2 text-sm leading-7 text-ink/80">
                  {priorities.map((priority, index) => (
                    <li key={`${priority.issue}-${index}`} className="flex gap-2">
                      <span className="font-serif text-ink">{index + 1}.</span>
                      <span>
                        {priority.focus ? (
                          <span className="mr-2 rounded-full border border-coral/20 bg-coral/5 px-2 py-0.5 text-xs text-ink/70">
                            {priority.focus}
                          </span>
                        ) : null}
                        {priority.issue}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-3 text-xs text-muted">詳細改寫示範見下方「逐項改寫指南」。</p>
            </CoachCard>
          </div>
        </section>

        <div data-section-id="rubric-observations">
          <CoachCard
            id="rubric-observations"
            title="HKDSE 四項評分觀察"
            eyebrow={`內容 40% · 表達 30% · 結構 20% · 標點 10%${
              wordCountShort ? `｜字數不足 ${RECOMMENDED_WORD_COUNT}：內容與結構已相應下調` : ""
            }`}
            className="p-6"
          >
            <ul className="grid gap-4 md:grid-cols-2">
              {DEFAULT_WRITING_RUBRIC.criteria.map((criterion) => {
                const value = toNumber(scores[criterion.key], 0);
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
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-good"
                        style={{ width: `${Math.max(12, pct)}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs leading-6 text-muted">{descriptorForScore(criterion, value)}</p>
                  </li>
                );
              })}
            </ul>
          </CoachCard>
        </div>

        {priorities.length > 0 ? (
          <section id="revision-guide" data-section-id="revision-guide" className="space-y-4 scroll-mt-32">
            <div>
              <p className="section-kicker">逐項改寫指南</p>
              <h2 className="mt-2 text-2xl">每一條都附「為何要改」與「可模仿的改寫示範」</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/75">
                不必一次全部改完，但全部列出來讓你看清楚還有哪些可以繼續練。先從排在最前面的著手。
              </p>
            </div>
            <ol className="grid gap-4 md:grid-cols-2">
              {priorities.map((priority, index) => (
                <li
                  key={`detail-${priority.issue}-${index}`}
                  className="rounded-[1.35rem] border border-border/70 bg-white/80 p-5 shadow-soft"
                >
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="font-serif text-base text-ink">第 {index + 1} 項</span>
                    {priority.focus ? (
                      <span className="rounded-full border border-accent/20 bg-accent/5 px-2 py-0.5 text-[0.68rem] tracking-[0.16em] text-accent">
                        {priority.focus}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 font-serif text-lg text-ink">{priority.issue}</p>
                  {priority.why ? (
                    <p className="mt-2 text-sm leading-7 text-ink/75">
                      <span className="mr-1 font-medium text-ink/80">為何要改：</span>
                      {priority.why}
                    </p>
                  ) : null}
                  {priority.how.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">怎樣改</p>
                      <ol className="mt-2 space-y-1.5 text-sm leading-7 text-ink/80">
                        {priority.how.map((step, stepIndex) => (
                          <li key={`${priority.issue}-step-${stepIndex}`} className="flex gap-2">
                            <span className="text-accent">{stepIndex + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                  {priority.example_before || priority.example_after ? (
                    <div className="mt-4 space-y-2 rounded-[1rem] border border-good/25 bg-good/5 p-3 text-sm leading-7">
                      {priority.example_before ? (
                        <div>
                          <span className="mr-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted">原文</span>
                          <span className="font-serif text-ink/80">「{priority.example_before}」</span>
                        </div>
                      ) : null}
                      {priority.example_after ? (
                        <div>
                          <span className="mr-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-good">改寫示範</span>
                          <span className="font-serif text-ink">{priority.example_after}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section id="annotations" data-section-id="annotations" className="space-y-4 scroll-mt-32">
          <div>
            <p className="section-kicker">文中批註</p>
            <h2 className="mt-2 text-2xl">選一句原文，對應建議就會跟著定位</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/75">
              先用上方清單跳到需要整理的位置；電腦版會把逐句建議固定在右邊，手機版則固定在畫面下方。
            </p>
          </div>
          <AnnotatedText
            text={submission.verifiedText}
            errors={submission.errors.map((error) => ({
              id: error.id,
              category: error.category,
              subcategory: error.subcategory,
              evidenceSpan: error.evidenceSpan,
              charOffsetStart: error.charOffsetStart,
              charOffsetEnd: error.charOffsetEnd,
              severity: error.severity,
              suggestion: error.suggestion,
              exampleFix: error.exampleFix,
              ocrSuspect: error.ocrSuspect,
            }))}
          />
        </section>

        <div id="workbench" data-section-id="workbench" className="scroll-mt-32">
          <RevisionComposer
            submissionId={submission.id}
            originalText={submission.verifiedText}
            priorities={priorities.map((p) => p.issue)}
            hasExistingRevision={Boolean(latestRevision)}
            aiSuggestions={aiSuggestions}
            recentNotebookEntries={recentNotebookEntries.map(serializeNotebookEntry)}
          />
        </div>

        <section id="model-passage" data-section-id="model-passage" className="space-y-4 scroll-mt-32">
          <div className="space-y-2">
            <p className="section-kicker">AI 參考範文</p>
            <h2 className="text-2xl">把完整示範獨立放一頁，需要時再專心看</h2>
            <p className="max-w-2xl text-sm leading-7 text-ink/75">
              這裡和訂正工作台分開，讓你在改寫時不會被整篇範文擠滿畫面；真的卡住時，再切過來看完整示範和重點變化。
            </p>
          </div>

          <ModelPassagePanel
            submissionId={submission.id}
            originalText={submission.verifiedText}
            initialPassage={submission.aiModelPassage ? serializeModelPassage(submission.aiModelPassage) : null}
            context="workbench"
          />

          <NotebookQuickPanel
            entries={recentNotebookEntries.map(serializeNotebookEntry)}
            submissionId={submission.id}
            title="AI 參考筆記"
            intro="看範文時，把真正想學走的一句句式、一次過渡寫法，或一條提醒直接記下來，下次改文時會更容易用得上。"
          />
        </section>

        <section id="error-categories" data-section-id="error-categories" className="space-y-4 scroll-mt-32">
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
                        {error.exampleFix ? (
                          <div className="mt-2 rounded-[0.8rem] border border-good/30 bg-good/10 px-3 py-1.5 text-sm leading-7 text-ink">
                            <span className="mr-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-good">試試</span>
                            <span className="font-serif">{error.exampleFix}</span>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </CoachCard>
              ))}
            </div>
          )}
        </section>
      </SubmissionSectionTabs>
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

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function BackLink() {
  return (
    <Link href="/" className="btn-secondary inline-flex">
      返回主頁
    </Link>
  );
}
