import Link from "next/link";
import { teacherClassWhere } from "@/lib/assignments";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TeacherDashboardPage() {
  const { clerkUserId, role } = await requireRole(["teacher", "admin"]);
  const isAdmin = role === "admin";

  const classes = await prisma.class.findMany({
    where: isAdmin ? undefined : { teacherClerkUserId: clerkUserId },
    orderBy: { createdAt: "desc" },
    include: { studentClasses: true },
  });

  const assignments = await prisma.assignment.findMany({
    where: { class: teacherClassWhere({ clerkUserId, isAdmin }) },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      class: { select: { name: true, _count: { select: { studentClasses: true } } } },
      submissions: { select: { userId: true } },
    },
  });

  const studentClerkUserIds = Array.from(
    new Set(classes.flatMap((klass) => klass.studentClasses.map((membership) => membership.studentClerkUserId))),
  );

  const students = studentClerkUserIds.length
    ? await prisma.appUser.findMany({
        where: { clerkUserId: { in: studentClerkUserIds } },
        orderBy: { name: "asc" },
      })
    : [];

  const submissions = isAdmin
    ? await prisma.submission.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          user: true,
          analyses: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      })
    : students.length
    ? await prisma.submission.findMany({
        where: { userId: { in: students.map((student) => student.id) } },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          user: true,
          analyses: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      })
    : [];

  return (
    <div className="space-y-8">
      <section className="paper-panel-strong p-6 sm:p-7">
        <p className="section-kicker">老師主頁</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">{isAdmin ? "查看所有學生的作品" : "查看已分配學生的作品"}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/75">
          {isAdmin ? "管理員可以從這裡總覽所有班級、學生與最近提交紀錄。" : "這裡只會顯示由管理員分配給你的班級、學生與提交紀錄。"}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="班級" value={`${classes.length}`} />
        <MetricCard label="學生" value={`${students.length}`} tone="primary" />
        <MetricCard label="最近作品" value={`${submissions.length}`} tone="positive" />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">寫作任務</p>
            <h2 className="mt-2 text-2xl">佈置題目，追蹤全班交稿</h2>
          </div>
          {classes.length > 0 ? (
            <Link href="/teacher/assignments/new" className="btn-primary">
              佈置新任務
            </Link>
          ) : null}
        </div>
        {assignments.length === 0 ? (
          <div className="paper-panel p-5 text-sm text-muted">
            還沒有寫作任務。佈置後，學生會在主頁看到題目，你可以在任務頁看到交稿情況、等級分佈和全班最常見的問題。
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {assignments.map((assignment) => (
              <Link
                key={assignment.id}
                href={`/teacher/assignments/${assignment.id}`}
                className="paper-panel block p-5 transition hover:border-accent/25"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {assignment.class.name}
                    {assignment.dueAt ? `・截止 ${formatDate(assignment.dueAt)}` : ""}
                  </span>
                  <span className="pill">
                    已交 {new Set(assignment.submissions.map((submission) => submission.userId)).size} /{" "}
                    {assignment.class._count.studentClasses}
                  </span>
                </div>
                <h3 className="mt-2 font-serif text-xl text-ink">《{assignment.taskPrompt}》</h3>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <p className="section-kicker">已分配學生</p>
          <h2 className="mt-2 text-2xl">按班級查看</h2>
        </div>
        {classes.length === 0 ? (
          <div className="paper-panel p-5 text-sm text-muted">{isAdmin ? "尚未建立班級。" : "尚未有班級分配給你。"}</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {classes.map((klass) => (
              <article key={klass.id} className="paper-panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xl text-ink">{klass.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="pill">{klass.studentClasses.length} 位學生</span>
                    <Link href={`/teacher/assignments/new?class=${klass.id}`} className="pill">
                      佈置任務
                    </Link>
                  </div>
                </div>
                <ul className="mt-4 space-y-2">
                  {klass.studentClasses.map((membership) => {
                    const student = students.find((item) => item.clerkUserId === membership.studentClerkUserId);
                    return (
                      <li key={membership.id} className="rounded-[1rem] border border-border/70 bg-white/75 px-4 py-3">
                        <div className="font-medium text-ink">{student?.name || membership.studentClerkUserId}</div>
                        <div className="text-xs text-muted">{student?.email || "未有電郵"}</div>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">學生作品</p>
            <h2 className="mt-2 text-2xl">最近提交</h2>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="paper-panel p-5 text-sm text-muted">暫時未有可查看的學生作品。</div>
        ) : (
          <div className="space-y-3">
            {submissions.map((submission) => {
              const analysis = submission.analyses[0];
              return (
                <Link key={submission.id} href={`/teacher/submissions/${submission.id}`} className="paper-panel block p-5 transition hover:border-accent/25">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="pill">{submission.user.name}</span>
                        <span className="text-xs text-muted">{formatDate(submission.createdAt)}</span>
                      </div>
                      <p className="mt-3 font-serif text-lg leading-8 text-ink">{previewFor(submission.verifiedText, 90)}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="font-serif text-3xl text-ink">{analysis ? analysis.overallScore.toFixed(0) : "…"}</div>
                      <div className="text-xs text-muted">{analysis ? "整體分數" : "等待分析"}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "primary" | "positive" }) {
  const toneClass =
    tone === "primary"
      ? "border-accent/20 bg-accent/5"
      : tone === "positive"
        ? "border-good/20 bg-good/10"
        : "border-border/70 bg-white/80";

  return (
    <div className={["rounded-[1.15rem] border px-4 py-4 shadow-soft", toneClass].join(" ")}>
      <p className="section-kicker">{label}</p>
      <div className="mt-2 text-3xl text-ink">{value}</div>
    </div>
  );
}

function previewFor(text: string, length: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= length ? normalized : `${normalized.slice(0, length)}…`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
