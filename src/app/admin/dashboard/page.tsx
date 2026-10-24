import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AdminUserDirectory, type AdminDirectoryUser } from "@/components/admin/AdminUserDirectory";
import { ClassManager } from "@/components/admin/ClassManager";
import { SyncClerkUsersButton } from "@/components/admin/SyncClerkUsersButton";
import { requireRole } from "@/lib/auth";
import { USAGE_REASONS, formatCreditReason, isUsageReason } from "@/lib/creditReasons";
import { isGlobalUnlimitedCreditsEnabled } from "@/lib/credits";
import { prisma } from "@/lib/db";
import { INITIAL_CREDIT_REASON } from "@/lib/signupCredits";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "users", label: "用戶與點數" },
  { value: "classes", label: "班級" },
  { value: "credits", label: "點數紀錄" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const LOG_TYPES = [
  { value: "all", label: "全部" },
  { value: "admin", label: "管理員調整" },
  { value: "usage", label: "提交與退回" },
  { value: "signup", label: "新用戶贈送" },
] as const;
type LogType = (typeof LOG_TYPES)[number]["value"];

export default async function AdminDashboardPage(props: {
  searchParams: Promise<{ tab?: string; user?: string; type?: string }>;
}) {
  const searchParams = await props.searchParams;
  const { clerkUserId: currentClerkUserId } = await requireRole(["admin"]);
  const tab: Tab = TABS.find((item) => item.value === searchParams.tab)?.value ?? "users";
  const globalUnlimitedCredits = isGlobalUnlimitedCreditsEnabled();

  const [linkedUsers, legacyUserCount, classCount] = await Promise.all([
    prisma.appUser.findMany({ where: { clerkUserId: { not: null } }, orderBy: { createdAt: "desc" } }),
    prisma.appUser.count({ where: { clerkUserId: null } }),
    prisma.class.count(),
  ]);
  const userByClerkId = new Map(linkedUsers.map((user) => [user.clerkUserId!, user]));
  const person = (user: (typeof linkedUsers)[number]) => ({ clerkUserId: user.clerkUserId!, name: user.name, email: user.email });

  return (
    <div className="space-y-6">
      <section className="paper-panel-strong p-6 sm:p-7">
        <p className="section-kicker">管理後台</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">用戶、班級與點數</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="pill">{linkedUsers.length} 位用戶</span>
          <span className="pill">{classCount} 個班級</span>
          <span className="pill">管理員提交文章不扣點</span>
        </div>
        {globalUnlimitedCredits ? (
          <p className="mt-4 rounded-[1rem] border border-good/20 bg-good/10 px-4 py-3 text-sm text-ink/80">
            全站無限點數（測試模式）開啟中：所有人提交文章都不會扣點。關閉（移除 GLOBAL_UNLIMITED_CREDITS 環境變數）後，會按各人的餘額扣點。
          </p>
        ) : null}
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="管理後台分頁">
        {TABS.map((item) => (
          <Link
            key={item.value}
            href={`/admin/dashboard?tab=${item.value}`}
            aria-current={tab === item.value ? "page" : undefined}
            className={tab === item.value ? "btn-primary" : "btn-secondary"}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "users" ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <SyncClerkUsersButton />
            <span className="text-xs text-muted">新用戶第一次登入後會自動出現；如果有人登入過但不在列表，按這裡同步。</span>
          </div>
          <AdminUserDirectory
            users={linkedUsers.map(
              (user): AdminDirectoryUser => ({
                id: user.id,
                name: user.name,
                email: user.email,
                clerkUserId: user.clerkUserId!,
                role: user.role,
                credits: user.credits,
                unlimitedCredits: user.unlimitedCredits,
                createdAtIso: user.createdAt.toISOString(),
                createdAtLabel: formatDate(user.createdAt),
              }),
            )}
            legacyUserCount={legacyUserCount}
            globalUnlimitedCredits={globalUnlimitedCredits}
            currentClerkUserId={currentClerkUserId}
          />
        </>
      ) : null}

      {tab === "classes" ? (
        <ClassesTab
          linkedUsers={linkedUsers}
          userByClerkId={userByClerkId}
          person={person}
        />
      ) : null}

      {tab === "credits" ? (
        <CreditsTab
          linkedUsers={linkedUsers}
          userByClerkId={userByClerkId}
          userFilter={searchParams.user && userByClerkId.has(searchParams.user) ? searchParams.user : ""}
          typeFilter={LOG_TYPES.find((item) => item.value === searchParams.type)?.value ?? "all"}
        />
      ) : null}
    </div>
  );
}

type LinkedUser = Awaited<ReturnType<typeof prisma.appUser.findMany>>[number];

async function ClassesTab({
  linkedUsers,
  userByClerkId,
  person,
}: {
  linkedUsers: LinkedUser[];
  userByClerkId: Map<string, LinkedUser>;
  person: (user: LinkedUser) => { clerkUserId: string; name: string; email: string | null };
}) {
  const classes = await prisma.class.findMany({ orderBy: { createdAt: "desc" }, include: { studentClasses: true } });
  return (
    <ClassManager
      classes={classes.map((klass) => ({
        id: klass.id,
        name: klass.name,
        teacherClerkUserId: klass.teacherClerkUserId,
        teacherName: userByClerkId.get(klass.teacherClerkUserId)?.name ?? "（老師帳戶已不存在）",
        students: klass.studentClasses
          .map((membership) => userByClerkId.get(membership.studentClerkUserId))
          .filter((user): user is LinkedUser => Boolean(user))
          .map(person)
          .sort((a, b) => a.name.localeCompare(b.name, "zh-HK")),
      }))}
      teachers={linkedUsers.filter((user) => user.role !== "student").map(person)}
      students={linkedUsers
        .filter((user) => user.role === "student")
        .map(person)
        .sort((a, b) => a.name.localeCompare(b.name, "zh-HK"))}
    />
  );
}

async function CreditsTab({
  linkedUsers,
  userByClerkId,
  userFilter,
  typeFilter,
}: {
  linkedUsers: LinkedUser[];
  userByClerkId: Map<string, LinkedUser>;
  userFilter: string;
  typeFilter: LogType;
}) {
  const typeWhere: Prisma.CreditTransactionWhereInput =
    typeFilter === "usage"
      ? { reason: { in: USAGE_REASONS } }
      : typeFilter === "signup"
        ? { reason: INITIAL_CREDIT_REASON }
        : typeFilter === "admin"
          ? { createdByClerkUserId: { not: null }, reason: { notIn: [...USAGE_REASONS, INITIAL_CREDIT_REASON] } }
          : {};
  const transactions = await prisma.creditTransaction.findMany({
    where: { ...typeWhere, ...(userFilter ? { clerkUserId: userFilter } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <section className="space-y-4">
      <form method="get" className="paper-panel grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="tab" value="credits" />
        <label className="block">
          <span className="field-label">用戶</span>
          <select name="user" defaultValue={userFilter} className="field-input min-h-0 py-2 text-sm">
            <option value="">所有用戶</option>
            {linkedUsers
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name, "zh-HK"))
              .map((user) => (
                <option key={user.id} value={user.clerkUserId!}>
                  {user.name}
                  {user.email ? `（${user.email}）` : ""}
                </option>
              ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">類別</span>
          <select name="type" defaultValue={typeFilter} className="field-input min-h-0 py-2 text-sm">
            {LOG_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-secondary">
          篩選
        </button>
      </form>

      <div className="paper-panel overflow-hidden">
        <div className="border-b border-border/70 px-4 py-3 text-sm text-muted">最近 {transactions.length} 筆（最多顯示 100 筆）</div>
        {transactions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">沒有符合條件的紀錄。</p>
        ) : (
          <div className="divide-y divide-border/70">
            {transactions.map((transaction) => {
              const user = userByClerkId.get(transaction.clerkUserId);
              const automatic = isUsageReason(transaction.reason) || transaction.reason === INITIAL_CREDIT_REASON;
              const by = automatic
                ? "系統"
                : transaction.createdByClerkUserId
                  ? (userByClerkId.get(transaction.createdByClerkUserId)?.name ?? "管理員")
                  : "系統";
              return (
                <div key={transaction.id} className="grid gap-1 px-4 py-3 text-sm md:grid-cols-[9rem_1fr_5rem_1.4fr_7rem] md:items-center md:gap-3">
                  <span className="text-xs text-muted">{formatDate(transaction.createdAt)}</span>
                  <span className="text-ink">{user?.name ?? "（已刪除的用戶）"}</span>
                  <span className={transaction.amount >= 0 ? "font-medium text-good" : "font-medium text-coral"}>
                    {transaction.amount >= 0 ? "+" : ""}
                    {transaction.amount}
                  </span>
                  <span className="text-ink/80">{formatCreditReason(transaction.reason)}</span>
                  <span className="text-xs text-muted">經手：{by}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function formatDate(value: Date) {
  return value.toLocaleString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
