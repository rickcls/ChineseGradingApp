import Link from "next/link";
import { DeleteSubmissionButton } from "@/components/DeleteSubmissionButton";
import { EnteringLinkButton } from "@/components/EnteringLinkButton";
import { StatePanel } from "@/components/StatePanel";
import { SubmissionHistoryTabs } from "@/components/SubmissionHistoryTabs";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type SubmissionForHistory = {
  id: string;
  source: string;
  status: string;
  verifiedText: string;
  createdAt: Date;
  analyses: { overallScore: number }[];
  revisionOrigin: { id: string }[];
};

export default async function SubmissionsHistoryPage() {
  const { appUser: user } = await requireRole(["student"]);
  const submissions = await prisma.submission.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      revisionOrigin: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
  });
  const groupedByMonth = groupByMonth(submissions);

  return (
    <div className="space-y-8">
      <section className="paper-panel-strong p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-kicker">作品紀錄</p>
            <h1 className="mt-2 text-3xl sm:text-4xl">重看、修訂或整理以前的文章</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/75">
              這裡會列出你所有已儲存的文章。可以用清單快速搜尋最近作品，也可以用月份日曆回看自己的練習節奏。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/submissions/new" className="btn-primary">
              提交新文章
            </Link>
            <Link href="/" className="btn-secondary">
              返回主頁
            </Link>
          </div>
        </div>
      </section>

      {submissions.length === 0 ? (
        <StatePanel
          state="empty"
          title="還沒有已儲存文章"
          description="先提交第一篇，之後所有批改紀錄都會集中在這裡，方便你回看和修訂。"
          actionHref="/submissions/new"
          actionLabel="開始第一篇"
        />
      ) : (
        <SubmissionHistoryTabs
          items={[
            { id: "list", label: `清單檢視（${submissions.length}）` },
            { id: "calendar", label: "月曆檢視" },
          ]}
        >
          <section data-history-view="list" className="space-y-4">
            {submissions.map((submission) => (
              <SubmissionHistoryCard key={submission.id} submission={submission} />
            ))}
          </section>

          <section data-history-view="calendar" className="space-y-6">
            {groupedByMonth.map((month) => (
              <div key={month.key} className="paper-panel p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-2xl">{month.label}</h2>
                  <span className="text-sm text-muted">{month.count} 篇</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {month.days.map((day) => (
                    <div key={day.key} className="rounded-[1.15rem] border border-border/70 bg-white/75 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-muted">{day.weekday}</div>
                          <div className="mt-1 font-serif text-2xl text-ink">{day.dayLabel}</div>
                        </div>
                        <span className="pill">{day.items.length} 篇</span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {day.items.map((submission) => (
                          <div key={submission.id} className="rounded-2xl border border-border/60 bg-white/80 p-3">
                            <Link
                              href={`/submissions/${submission.id}`}
                              className="block font-serif text-base leading-7 text-ink hover:text-accent"
                            >
                              {previewFor(submission.verifiedText, 34)}
                            </Link>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                              <span>{scoreLabel(submission)}</span>
                              {submission.revisionOrigin.length > 0 ? <span className="pill pill-positive">已有修訂</span> : null}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <EnteringLinkButton
                                href={`/submissions/${submission.id}#workbench`}
                                className="btn-secondary px-3 py-1.5 text-xs"
                              >
                                編輯修訂
                              </EnteringLinkButton>
                              <DeleteSubmissionButton
                                submissionId={submission.id}
                                className="inline-flex items-center justify-center rounded-full border border-coral/30 bg-coral/10 px-3 py-1.5 text-xs font-medium text-coral transition hover:bg-coral/15 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </SubmissionHistoryTabs>
      )}
    </div>
  );
}

function SubmissionHistoryCard({ submission }: { submission: SubmissionForHistory }) {
  const hasRevision = submission.revisionOrigin.length > 0;

  return (
    <article className="paper-panel p-5 transition hover:border-accent/25 hover:shadow-float">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={submission.source === "typed" ? "pill" : "pill pill-warm"}>{sourceLabel(submission.source)}</span>
            <span className="text-xs text-muted">{formatFullDate(submission.createdAt)}</span>
            {hasRevision ? <span className="pill pill-positive">已有修訂對照</span> : null}
            {submission.status === "failed" ? <span className="pill pill-warm">分析未完成</span> : null}
          </div>
          <Link href={`/submissions/${submission.id}`} className="block font-serif text-xl leading-9 text-ink hover:text-accent">
            {previewFor(submission.verifiedText, 88)}
          </Link>
        </div>

        <div className="flex flex-col gap-3 lg:w-56 lg:items-end">
          <div className="rounded-[1rem] border border-accent/20 bg-accent/5 px-4 py-3 text-left lg:text-right">
            <div className="font-serif text-3xl text-ink">{scoreValue(submission)}</div>
            <div className="text-xs text-muted">{submission.analyses[0] ? "整體分數" : "等待分析"}</div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <EnteringLinkButton href={`/submissions/${submission.id}`} className="btn-primary px-4 py-2">
              查看批改
            </EnteringLinkButton>
            <EnteringLinkButton href={`/submissions/${submission.id}#workbench`} className="btn-secondary px-4 py-2">
              編輯修訂
            </EnteringLinkButton>
            <DeleteSubmissionButton submissionId={submission.id} />
          </div>
        </div>
      </div>
    </article>
  );
}

function groupByMonth(submissions: SubmissionForHistory[]) {
  const monthMap = new Map<
    string,
    {
      key: string;
      label: string;
      count: number;
      dayMap: Map<
        string,
        {
          key: string;
          dayLabel: string;
          weekday: string;
          items: SubmissionForHistory[];
        }
      >;
    }
  >();

  for (const submission of submissions) {
    const monthKey = submission.createdAt.toISOString().slice(0, 7);
    const dayKey = submission.createdAt.toISOString().slice(0, 10);
    const month = monthMap.get(monthKey) || {
      key: monthKey,
      label: submission.createdAt.toLocaleDateString("zh-HK", { year: "numeric", month: "long" }),
      count: 0,
      dayMap: new Map(),
    };
    const day = month.dayMap.get(dayKey) || {
      key: dayKey,
      dayLabel: submission.createdAt.toLocaleDateString("zh-HK", { day: "numeric" }),
      weekday: submission.createdAt.toLocaleDateString("zh-HK", { weekday: "short" }),
      items: [],
    };

    day.items.push(submission);
    month.dayMap.set(dayKey, day);
    month.count += 1;
    monthMap.set(monthKey, month);
  }

  return Array.from(monthMap.values()).map((month) => ({
    key: month.key,
    label: month.label,
    count: month.count,
    days: Array.from(month.dayMap.values()),
  }));
}

function previewFor(text: string, length: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= length) return normalized || "未命名文章";
  return `${normalized.slice(0, length)}…`;
}

function scoreValue(submission: SubmissionForHistory) {
  const analysis = submission.analyses[0];
  if (!analysis) return "…";
  return analysis.overallScore.toFixed(0);
}

function scoreLabel(submission: SubmissionForHistory) {
  const score = scoreValue(submission);
  return score === "…" ? "等待分析" : `分數 ${score}`;
}

function sourceLabel(source: string) {
  if (source === "photo") return "拍照交稿";
  if (source === "scan") return "掃描稿";
  return "直接輸入";
}

function formatFullDate(value: Date) {
  return value.toLocaleDateString("zh-HK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}
