import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignmentControls } from "@/components/teacher/AssignmentControls";
import {
  PROGRESS_LABEL,
  assignmentProgress,
  commonIssues,
  levelDistribution,
  teacherClassWhere,
} from "@/lib/assignments";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TeacherAssignmentPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { clerkUserId, role } = await requireRole(["teacher", "admin"]);

  const assignment = await prisma.assignment.findFirst({
    where: { id: params.id, class: teacherClassWhere({ clerkUserId, isAdmin: role === "admin" }) },
    include: {
      class: { include: { studentClasses: true } },
      submissions: {
        orderBy: { createdAt: "asc" },
        include: {
          analyses: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { overallScore: true, scores: true, _count: { select: { teacherReviews: true } } },
          },
          errors: { select: { category: true, subcategory: true, ocrSuspect: true, studentReaction: true } },
        },
      },
    },
  });
  if (!assignment) notFound();

  const studentClerkIds = assignment.class.studentClasses.map((membership) => membership.studentClerkUserId);
  const students = studentClerkIds.length
    ? await prisma.appUser.findMany({ where: { clerkUserId: { in: studentClerkIds } }, orderBy: { name: "asc" } })
    : [];

  const now = new Date();
  const roster = students.map((student) => {
    const essays = assignment.submissions.filter((submission) => submission.userId === student.id);
    const first = essays[0] ?? null;
    const latest = essays[essays.length - 1] ?? null;
    const analysis = latest?.analyses[0] ?? null;
    const scores = (analysis?.scores ?? {}) as Record<string, unknown>;
    return {
      student,
      progress: assignmentProgress(assignment.dueAt, first?.createdAt ?? null, now),
      essayCount: essays.length,
      latest,
      analysis,
      level: typeof scores.dse_level === "string" ? scores.dse_level : null,
      reviewed: (analysis?._count.teacherReviews ?? 0) > 0,
    };
  });

  const graded = roster.filter((row) => row.analysis);
  const submittedCount = roster.filter((row) => row.progress === "submitted" || row.progress === "late").length;
  const lateCount = roster.filter((row) => row.progress === "late").length;
  const reviewedCount = roster.filter((row) => row.reviewed).length;
  const levels = levelDistribution(graded.map((row) => row.level ?? ""));
  const maxLevelCount = Math.max(1, ...levels.map((item) => item.count));
  const issues = commonIssues(graded.map((row) => ({ errors: row.latest?.errors ?? [] })));

  return (
    <div className="space-y-6">
      <Link href="/teacher/dashboard" className="btn-secondary inline-flex">
        返回老師主頁
      </Link>

      <section className="paper-panel-strong p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-kicker">
              寫作任務・{assignment.class.name}
              {assignment.dueAt ? `・截止 ${formatDateTime(assignment.dueAt)}` : "・沒有截止日期"}
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl">《{assignment.taskPrompt}》</h1>
            <p className="mt-2 text-sm text-muted">{assignment.genre ? `文體：${assignment.genre}` : "文體不限"}</p>
            {assignment.instructions ? (
              <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-ink/80">{assignment.instructions}</p>
            ) : null}
          </div>
          <div className="lg:w-80">
            <AssignmentControls assignmentId={assignment.id} modelPassageReleased={assignment.modelPassageReleased} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="已交" value={`${submittedCount} / ${roster.length}`} />
        <MetricCard label="遲交" value={`${lateCount}`} />
        <MetricCard label="已覆核" value={`${reviewedCount}`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="paper-panel p-5">
          <p className="section-kicker">AI 估算等級分佈</p>
          {levels.length === 0 ? (
            <p className="mt-3 text-sm text-muted">還沒有已批改的文章。</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {levels.map((item) => (
                <li key={item.level} className="flex items-center gap-3 text-sm">
                  <span className="w-12 font-serif text-lg text-ink">L{item.level}</span>
                  <span className="h-3 rounded-full bg-accent/60" style={{ width: `${(item.count / maxLevelCount) * 70}%` }} />
                  <span className="text-muted">{item.count} 人</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">按每位學生最新一篇計算；AI 估算，只供參考。</p>
        </div>
        <div className="paper-panel p-5">
          <p className="section-kicker">全班最常見的問題</p>
          {issues.length === 0 ? (
            <p className="mt-3 text-sm text-muted">還沒有足夠的批改資料。</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {issues.map((issue) => (
                <li
                  key={`${issue.category}-${issue.subcategory}`}
                  className="flex items-center justify-between gap-3 rounded-[0.9rem] border border-border/70 bg-white/75 px-3 py-2 text-sm"
                >
                  <span className="text-ink">
                    {issue.category}・{issue.subcategory}
                  </span>
                  <span className="text-muted">
                    {issue.students} 位同學・共 {issue.occurrences} 處
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-muted">不計 OCR 可能讀錯和學生回報有誤的批註，適合用來決定下一課先講甚麼。</p>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="section-kicker">學生名單</p>
          <h2 className="mt-2 text-2xl">交稿情況</h2>
        </div>
        {roster.length === 0 ? (
          <div className="paper-panel p-5 text-sm text-muted">這個班級暫時沒有學生。</div>
        ) : (
          <ul className="space-y-2">
            {roster.map((row) => (
              <li
                key={row.student.id}
                className="paper-panel flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{row.student.name}</span>
                  <span
                    className={[
                      "pill",
                      row.progress === "submitted" ? "pill-positive" : row.progress === "not_submitted" ? "" : "pill-warm",
                    ].join(" ")}
                  >
                    {PROGRESS_LABEL[row.progress]}
                  </span>
                  {row.essayCount > 1 ? <span className="text-xs text-muted">交了 {row.essayCount} 次</span> : null}
                  {row.reviewed ? <span className="pill pill-positive">已覆核</span> : null}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {row.latest ? (
                    <>
                      <span className="text-ink/80">
                        {row.analysis
                          ? `${row.level ? `L${row.level}・` : ""}${row.analysis.overallScore.toFixed(0)} 分`
                          : row.latest.status === "failed"
                            ? "批改失敗"
                            : "批改中"}
                      </span>
                      <Link href={`/teacher/submissions/${row.latest.id}`} className="btn-secondary">
                        查看／覆核
                      </Link>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-border/70 bg-white/80 px-4 py-4 shadow-soft">
      <p className="section-kicker">{label}</p>
      <div className="mt-2 text-3xl text-ink">{value}</div>
    </div>
  );
}

function formatDateTime(value: Date) {
  return value.toLocaleString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
