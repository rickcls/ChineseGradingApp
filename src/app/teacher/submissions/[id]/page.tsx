import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeRevisionPriorities } from "@/lib/revisionPriority";

export const dynamic = "force-dynamic";

export default async function TeacherSubmissionDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { clerkUserId, role } = await requireRole(["teacher", "admin"]);
  const isAdmin = role === "admin";

  const classes = await prisma.class.findMany({
    where: isAdmin ? undefined : { teacherClerkUserId: clerkUserId },
    include: { studentClasses: true },
  });
  const assignedStudentClerkUserIds = classes.flatMap((klass) =>
    klass.studentClasses.map((membership) => membership.studentClerkUserId),
  );

  if (!isAdmin && assignedStudentClerkUserIds.length === 0) notFound();

  const submission = await prisma.submission.findFirst({
    where: {
      id: params.id,
      ...(isAdmin ? {} : { user: { clerkUserId: { in: assignedStudentClerkUserIds } } }),
    },
    include: {
      user: true,
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      errors: { orderBy: { charOffsetStart: "asc" } },
    },
  });

  if (!submission) notFound();

  const analysis = submission.analyses[0];
  const strengths = normalizeStringArray(analysis?.strengths);
  const priorities = normalizeRevisionPriorities(analysis?.revisionPriorities).map((priority) => priority.issue);

  return (
    <div className="space-y-6">
      <Link href="/teacher/dashboard" className="btn-secondary inline-flex">
        返回老師主頁
      </Link>

      <section className="paper-panel-strong p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">學生作品</p>
            <h1 className="mt-2 text-3xl sm:text-4xl">{submission.user.name}</h1>
            <p className="mt-2 text-sm text-muted">{formatDate(submission.createdAt)}</p>
          </div>
          <div className="rounded-[1.15rem] border border-accent/20 bg-accent/5 px-5 py-4">
            <div className="font-serif text-4xl text-ink">{analysis ? analysis.overallScore.toFixed(0) : "…"}</div>
            <div className="text-xs text-muted">{analysis ? "整體分數" : "等待分析"}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <article className="paper-panel p-5">
          <p className="section-kicker">原文</p>
          <div className="mt-3 whitespace-pre-wrap font-serif text-lg leading-9 text-ink">{submission.verifiedText}</div>
        </article>

        <article className="paper-panel p-5">
          <p className="section-kicker">AI 回饋</p>
          {analysis ? (
            <div className="mt-3 space-y-5">
              <p className="whitespace-pre-wrap text-sm leading-7 text-ink/80">{analysis.coachFeedbackText}</p>
              <SummaryList title="亮點" items={strengths} />
              <SummaryList title="改進重點" items={priorities} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">這篇作品仍未完成分析。</p>
          )}
        </article>
      </section>

      <section className="paper-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="section-kicker">文中批註</p>
            <h2 className="mt-2 text-2xl">錯誤與建議</h2>
          </div>
          <span className="pill">{submission.errors.length} 項</span>
        </div>
        {submission.errors.length === 0 ? (
          <p className="mt-4 text-sm text-muted">暫時沒有批註紀錄。</p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {submission.errors.map((error) => (
              <li key={error.id} className="rounded-[1.15rem] border border-border/70 bg-white/75 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="pill pill-warm">{error.category}</span>
                  <span className="text-xs text-muted">{error.subcategory}</span>
                </div>
                <blockquote className="mt-3 border-l-2 border-accent/30 pl-3 font-serif text-ink">{error.evidenceSpan}</blockquote>
                <p className="mt-3 text-sm leading-7 text-muted">{error.suggestion}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="font-medium text-ink">{title}</h2>
      <ul className="mt-2 space-y-2 text-sm leading-7 text-muted">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function formatDate(value: Date) {
  return value.toLocaleDateString("zh-HK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
