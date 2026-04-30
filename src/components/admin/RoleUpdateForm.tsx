import { type UserRole } from "@prisma/client";
import { updateUserRoleAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/AdminSubmitButton";

const ROLE_LABELS: Record<UserRole, string> = {
  student: "學生",
  teacher: "老師",
  admin: "管理員",
};

export function RoleUpdateForm({
  targetClerkUserId,
  currentRole,
}: {
  targetClerkUserId: string | null;
  currentRole: UserRole;
}) {
  if (!targetClerkUserId) {
    return <span className="text-xs text-muted">尚未連結 Clerk</span>;
  }

  return (
    <form action={updateUserRoleAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="targetClerkUserId" value={targetClerkUserId} />
      <select name="role" defaultValue={currentRole} className="field-input min-h-0 w-32 py-2 text-sm">
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <option key={role} value={role}>
            {label}
          </option>
        ))}
      </select>
      <AdminSubmitButton className="btn-secondary px-3 py-2 text-xs" pendingText="更新中...">
        更新角色
      </AdminSubmitButton>
    </form>
  );
}
