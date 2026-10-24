import Link from "next/link";
import { StatePanel } from "@/components/StatePanel";
import { AssignmentForm } from "@/components/teacher/AssignmentForm";
import { teacherClassWhere } from "@/lib/assignments";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage(props: { searchParams: Promise<{ class?: string }> }) {
  const { class: defaultClassId } = await props.searchParams;
  const { clerkUserId, role } = await requireRole(["teacher", "admin"]);

  const classes = await prisma.class.findMany({
    where: teacherClassWhere({ clerkUserId, isAdmin: role === "admin" }),
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { studentClasses: true } } },
  });

  return (
    <div className="space-y-6">
      <Link href="/teacher/dashboard" className="btn-secondary inline-flex">
        返回老師主頁
      </Link>
      <section className="paper-panel-strong p-6 sm:p-7">
        <p className="section-kicker">寫作任務</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">佈置一份寫作任務</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/75">
          學生會在主頁看到這份任務，用你定的題目和文體寫作。你可以在任務頁看到誰已交稿、全班的等級分佈和最常見的問題。
        </p>
      </section>
      {classes.length === 0 ? (
        <StatePanel
          state="empty"
          title="尚未有班級"
          description="請先請管理員建立班級並加入學生，之後就可以佈置任務。"
          actionHref="/teacher/dashboard"
          actionLabel="返回老師主頁"
        />
      ) : (
        <section className="paper-panel p-5 sm:p-6">
          <AssignmentForm
            classes={classes.map((klass) => ({ id: klass.id, name: klass.name, studentCount: klass._count.studentClasses }))}
            defaultClassId={defaultClassId}
          />
        </section>
      )}
    </div>
  );
}
