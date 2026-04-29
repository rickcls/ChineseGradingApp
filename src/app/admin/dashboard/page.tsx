import { type UserRole } from "@prisma/client";
import { CreditAdjustmentForm } from "@/components/admin/CreditAdjustmentForm";
import { RoleUpdateForm } from "@/components/admin/RoleUpdateForm";
import { UnlimitedCreditsForm } from "@/components/admin/UnlimitedCreditsForm";
import { requireRole } from "@/lib/auth";
import { isGlobalUnlimitedCreditsEnabled } from "@/lib/credits";
import { prisma } from "@/lib/db";
import { assignStudentToClassAction, createClassAction } from "../actions";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<UserRole, string> = {
  student: "學生",
  teacher: "老師",
  admin: "管理員",
};

export default async function AdminDashboardPage() {
  await requireRole(["admin"]);
  const globalUnlimitedCredits = isGlobalUnlimitedCreditsEnabled();

  const [users, transactions, classes] = await Promise.all([
    prisma.appUser.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.creditTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.class.findMany({
      orderBy: { createdAt: "desc" },
      include: { studentClasses: true },
    }),
  ]);

  const linkedUsers = users.filter((user) => user.clerkUserId);
  const legacyUsers = users.filter((user) => !user.clerkUserId);
  const teachers = linkedUsers.filter((user) => user.role === "teacher");
  const students = linkedUsers.filter((user) => user.role === "student");
  const userByClerkId = new Map(linkedUsers.map((user) => [user.clerkUserId!, user]));

  return (
    <div className="space-y-8">
      <section className="paper-panel-strong p-6 sm:p-7">
        <p className="section-kicker">管理員主頁</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">角色、點數與班級管理</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/75">
          所有角色與點數變更都在伺服器端檢查管理員權限；點數每次變動都會保留交易紀錄。
        </p>
        {globalUnlimitedCredits ? (
          <p className="mt-4 rounded-[1rem] border border-good/20 bg-good/10 px-4 py-3 text-sm text-ink/80">
            UAT 全站無限點數已啟用；所有學生提交文章時都不會扣點。
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <div>
          <p className="section-kicker">用戶列表</p>
          <h2 className="mt-2 text-2xl">更改角色與調整點數</h2>
          {legacyUsers.length > 0 ? (
            <p className="mt-2 text-sm leading-7 text-muted">
              已隱藏 {legacyUsers.length} 個舊匿名紀錄；那些紀錄未連結 Clerk，不能用角色或點數系統管理。
            </p>
          ) : null}
        </div>
        <div className="space-y-3">
          {linkedUsers.length === 0 ? (
            <div className="paper-panel p-5 text-sm text-muted">
              暫時沒有已連結 Clerk 的用戶。請讓學生或老師先登入一次，他們就會出現在這裡。
            </div>
          ) : null}
          {linkedUsers.map((user) => (
            <article key={user.id} className="paper-panel p-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(14rem,1fr)_minmax(18rem,1.1fr)_minmax(24rem,1.4fr)] xl:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg text-ink">{user.name}</h3>
                    <span className="pill">{ROLE_LABELS[user.role]}</span>
                    <span className="pill pill-positive">
                      {globalUnlimitedCredits || user.unlimitedCredits ? "無限點數" : `${user.credits} 點`}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-xs text-muted">{user.email || "未有電郵"}</p>
                  <p className="mt-1 break-all text-xs text-muted">{user.clerkUserId}</p>
                </div>
                <RoleUpdateForm targetClerkUserId={user.clerkUserId} currentRole={user.role} />
                <div className="space-y-2">
                  <UnlimitedCreditsForm targetClerkUserId={user.clerkUserId} enabled={user.unlimitedCredits} />
                  <CreditAdjustmentForm targetClerkUserId={user.clerkUserId} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="paper-panel p-5">
          <p className="section-kicker">建立班級</p>
          <h2 className="mt-2 text-2xl">指派老師</h2>
          <form action={createClassAction} className="mt-4 space-y-3">
            <label className="block">
              <span className="field-label">班級名稱</span>
              <input name="name" required placeholder="例：S3 中文寫作班" className="field-input" />
            </label>
            <label className="block">
              <span className="field-label">老師</span>
              <select name="teacherClerkUserId" required className="field-input" defaultValue="">
                <option value="" disabled>
                  選擇老師
                </option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.clerkUserId!}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-primary">
              建立班級
            </button>
          </form>
        </div>

        <div className="paper-panel p-5">
          <p className="section-kicker">學生分班</p>
          <h2 className="mt-2 text-2xl">把學生加入班級</h2>
          <form action={assignStudentToClassAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="block">
              <span className="field-label">班級</span>
              <select name="classId" required className="field-input" defaultValue="">
                <option value="" disabled>
                  選擇班級
                </option>
                {classes.map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {klass.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">學生</span>
              <select name="studentClerkUserId" required className="field-input" defaultValue="">
                <option value="" disabled>
                  選擇學生
                </option>
                {students.map((student) => (
                  <option key={student.id} value={student.clerkUserId!}>
                    {student.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-secondary">
              加入
            </button>
          </form>

          <div className="mt-5 space-y-3">
            {classes.length === 0 ? (
              <p className="text-sm text-muted">尚未建立班級。</p>
            ) : (
              classes.map((klass) => {
                const teacher = userByClerkId.get(klass.teacherClerkUserId);
                return (
                  <div key={klass.id} className="rounded-[1.15rem] border border-border/70 bg-white/75 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>{klass.name}</strong>
                      <span className="pill">{klass.studentClasses.length} 位學生</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">老師：{teacher?.name || klass.teacherClerkUserId}</p>
                    <p className="mt-2 text-sm text-muted">
                      {klass.studentClasses
                        .map((membership) => userByClerkId.get(membership.studentClerkUserId)?.name || membership.studentClerkUserId)
                        .join("、") || "尚未加入學生"}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="section-kicker">點數交易紀錄</p>
          <h2 className="mt-2 text-2xl">最近 50 筆</h2>
        </div>
        <div className="paper-panel overflow-hidden">
          <div className="divide-y divide-border/70">
            {transactions.map((transaction) => {
              const user = userByClerkId.get(transaction.clerkUserId);
              return (
                <div key={transaction.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_7rem_1fr_9rem] md:items-center">
                  <span>{user?.name || transaction.clerkUserId}</span>
                  <span className={transaction.amount >= 0 ? "text-good" : "text-coral"}>
                    {transaction.amount >= 0 ? "+" : ""}
                    {transaction.amount}
                  </span>
                  <span className="break-all text-muted">{transaction.reason}</span>
                  <span className="text-xs text-muted">{formatDate(transaction.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
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
