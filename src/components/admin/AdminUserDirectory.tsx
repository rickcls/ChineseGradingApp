"use client";

import { useMemo, useState } from "react";
import { type UserRole } from "@prisma/client";
import { CreditAdjustmentForm } from "@/components/admin/CreditAdjustmentForm";
import { RoleUpdateForm } from "@/components/admin/RoleUpdateForm";
import { UnlimitedCreditsForm } from "@/components/admin/UnlimitedCreditsForm";

export type AdminDirectoryUser = {
  id: string;
  name: string;
  email: string | null;
  clerkUserId: string;
  role: UserRole;
  credits: number;
  unlimitedCredits: boolean;
  createdAtIso: string;
  createdAtLabel: string;
};

type RoleFilter = "all" | UserRole;
type CreditFilter = "all" | "limited" | "unlimited";
type SortKey = "newest" | "name" | "credits";

const ROLE_LABELS: Record<UserRole, string> = {
  student: "學生",
  teacher: "老師",
  admin: "管理員",
};

const ROLE_FILTERS: Array<{ value: RoleFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "student", label: "學生" },
  { value: "teacher", label: "老師" },
  { value: "admin", label: "管理員" },
];

export function AdminUserDirectory({
  users,
  legacyUserCount,
  globalUnlimitedCredits,
}: {
  users: AdminDirectoryUser[];
  legacyUserCount: number;
  globalUnlimitedCredits: boolean;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [creditFilter, setCreditFilter] = useState<CreditFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [selectedClerkUserId, setSelectedClerkUserId] = useState(users[0]?.clerkUserId ?? "");

  const stats = useMemo(
    () => ({
      total: users.length,
      students: users.filter((user) => user.role === "student").length,
      teachers: users.filter((user) => user.role === "teacher").length,
      admins: users.filter((user) => user.role === "admin").length,
      unlimited: users.filter((user) => user.unlimitedCredits).length,
    }),
    [users],
  );

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users
      .filter((user) => {
        const matchesQuery =
          !normalizedQuery ||
          [user.name, user.email ?? "", user.clerkUserId].some((value) => value.toLowerCase().includes(normalizedQuery));
        const matchesRole = roleFilter === "all" || user.role === roleFilter;
        const matchesCredits =
          creditFilter === "all" ||
          (creditFilter === "unlimited"
            ? globalUnlimitedCredits || user.unlimitedCredits
            : !globalUnlimitedCredits && !user.unlimitedCredits);

        return matchesQuery && matchesRole && matchesCredits;
      })
      .sort((a, b) => {
        if (sortKey === "name") {
          return a.name.localeCompare(b.name, "zh-HK");
        }
        if (sortKey === "credits") {
          return b.credits - a.credits;
        }
        return new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime();
      });
  }, [creditFilter, globalUnlimitedCredits, query, roleFilter, sortKey, users]);

  const selectedUser =
    filteredUsers.find((user) => user.clerkUserId === selectedClerkUserId) ?? filteredUsers[0] ?? null;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker">用戶列表</p>
          <h2 className="mt-2 text-2xl">更改角色與調整點數</h2>
          {legacyUserCount > 0 ? (
            <p className="mt-2 text-sm leading-7 text-muted">
              已隱藏 {legacyUserCount} 個舊匿名紀錄；那些紀錄未連結 Clerk，不能用角色或點數系統管理。
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5 lg:min-w-[32rem]">
          <Stat label="全部" value={stats.total} />
          <Stat label="學生" value={stats.students} />
          <Stat label="老師" value={stats.teachers} />
          <Stat label="管理員" value={stats.admins} />
          <Stat label="無限點數" value={globalUnlimitedCredits ? stats.total : stats.unlimited} />
        </div>
      </div>

      <div className="paper-panel p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(18rem,1fr)_auto_auto] xl:items-end">
          <label className="block">
            <span className="field-label">搜尋</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="姓名、電郵或 Clerk ID"
              className="field-input"
            />
          </label>
          <div>
            <span className="field-label">角色</span>
            <div className="flex flex-wrap gap-2">
              {ROLE_FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setRoleFilter(item.value)}
                  aria-pressed={item.value === roleFilter}
                  className={item.value === roleFilter ? "btn-primary px-4 py-2 text-xs" : "btn-secondary px-4 py-2 text-xs"}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[24rem]">
            <label className="block">
              <span className="field-label">點數</span>
              <select
                value={creditFilter}
                onChange={(event) => setCreditFilter(event.target.value as CreditFilter)}
                className="field-input min-h-0 py-2"
              >
                <option value="all">全部</option>
                <option value="limited">一般點數</option>
                <option value="unlimited">無限點數</option>
              </select>
            </label>
            <label className="block">
              <span className="field-label">排序</span>
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="field-input min-h-0 py-2"
              >
                <option value="newest">最新建立</option>
                <option value="name">姓名</option>
                <option value="credits">點數最多</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="paper-panel p-5 text-sm text-muted">
          暫時沒有已連結 Clerk 的用戶。請讓學生或老師先登入一次，他們就會出現在這裡。
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="paper-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 text-sm text-muted">
              <span>
                顯示 {filteredUsers.length} / {users.length} 位用戶
              </span>
              {query || roleFilter !== "all" || creditFilter !== "all" ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setRoleFilter("all");
                    setCreditFilter("all");
                  }}
                  className="text-accent hover:text-accent/80"
                >
                  清除篩選
                </button>
              ) : null}
            </div>

            <div className="hidden max-h-[42rem] overflow-auto xl:block">
              <table className="w-full min-w-[52rem] border-separate border-spacing-0 text-left text-sm">
                <thead className="sticky top-0 z-10 bg-cream/95 text-xs uppercase tracking-[0.16em] text-muted backdrop-blur">
                  <tr>
                    <th className="border-b border-border/70 px-4 py-3 font-semibold">用戶</th>
                    <th className="border-b border-border/70 px-4 py-3 font-semibold">角色</th>
                    <th className="border-b border-border/70 px-4 py-3 font-semibold">點數</th>
                    <th className="border-b border-border/70 px-4 py-3 font-semibold">建立日期</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const isSelected = user.clerkUserId === selectedUser?.clerkUserId;

                    return (
                      <tr
                        key={user.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        aria-label={`管理 ${user.name}`}
                        onClick={() => setSelectedClerkUserId(user.clerkUserId)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedClerkUserId(user.clerkUserId);
                          }
                        }}
                        className={
                          isSelected
                            ? "cursor-pointer bg-mist/70 outline outline-1 outline-accent/20"
                            : "cursor-pointer odd:bg-white/45 even:bg-cream/35 hover:bg-mist/45"
                        }
                      >
                        <td className="border-b border-border/60 px-4 py-3 align-middle">
                          <div className="font-medium text-ink">{user.name}</div>
                          <div className="mt-1 break-all text-xs text-muted">{user.email || "未有電郵"}</div>
                          <div className="mt-1 break-all font-mono text-[0.68rem] text-muted">{user.clerkUserId}</div>
                        </td>
                        <td className="border-b border-border/60 px-4 py-3 align-middle">
                          <span className="pill">{ROLE_LABELS[user.role]}</span>
                        </td>
                        <td className="border-b border-border/60 px-4 py-3 align-middle">
                          <CreditBadge user={user} globalUnlimitedCredits={globalUnlimitedCredits} />
                        </td>
                        <td className="border-b border-border/60 px-4 py-3 align-middle text-xs text-muted">
                          {user.createdAtLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-3 xl:hidden">
              {filteredUsers.map((user) => (
                <details key={user.id} className="rounded-[1rem] border border-border/70 bg-white/75 p-4">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-ink">{user.name}</div>
                        <div className="mt-1 break-all text-xs text-muted">{user.email || "未有電郵"}</div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <span className="pill">{ROLE_LABELS[user.role]}</span>
                        <CreditBadge user={user} globalUnlimitedCredits={globalUnlimitedCredits} />
                      </div>
                    </div>
                    <div className="mt-2 break-all font-mono text-[0.68rem] text-muted">{user.clerkUserId}</div>
                  </summary>
                  <UserManagementPanel user={user} globalUnlimitedCredits={globalUnlimitedCredits} compact />
                </details>
              ))}
            </div>

            {filteredUsers.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted">找不到符合條件的用戶。</div>
            ) : null}
          </div>

          <aside className="hidden xl:block">
            <div className="paper-panel sticky top-4 p-5">
              {selectedUser ? (
                <UserManagementPanel user={selectedUser} globalUnlimitedCredits={globalUnlimitedCredits} />
              ) : (
                <p className="text-sm text-muted">選取一位用戶後即可管理角色與點數。</p>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1rem] border border-border/70 bg-white/80 px-3 py-2">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}

function CreditBadge({
  user,
  globalUnlimitedCredits,
}: {
  user: AdminDirectoryUser;
  globalUnlimitedCredits: boolean;
}) {
  return (
    <span className={globalUnlimitedCredits || user.unlimitedCredits ? "pill pill-positive" : "pill"}>
      {globalUnlimitedCredits || user.unlimitedCredits ? "無限點數" : `${user.credits} 點`}
    </span>
  );
}

function UserManagementPanel({
  user,
  globalUnlimitedCredits,
  compact = false,
}: {
  user: AdminDirectoryUser;
  globalUnlimitedCredits: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mt-4 border-t border-border/70 pt-4" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-kicker">管理用戶</p>
          <h3 className="mt-2 text-xl text-ink">{user.name}</h3>
          <p className="mt-1 break-all text-xs text-muted">{user.email || "未有電郵"}</p>
        </div>
        <CreditBadge user={user} globalUnlimitedCredits={globalUnlimitedCredits} />
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <span className="field-label">角色</span>
          <RoleUpdateForm targetClerkUserId={user.clerkUserId} currentRole={user.role} />
        </div>
        <div>
          <span className="field-label">測試點數</span>
          <UnlimitedCreditsForm targetClerkUserId={user.clerkUserId} enabled={user.unlimitedCredits} />
        </div>
        <div>
          <span className="field-label">調整點數</span>
          <CreditAdjustmentForm targetClerkUserId={user.clerkUserId} />
        </div>
      </div>
    </div>
  );
}
