import { updateUnlimitedCreditsAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/AdminSubmitButton";

export function UnlimitedCreditsForm({
  targetClerkUserId,
  enabled,
}: {
  targetClerkUserId: string | null;
  enabled: boolean;
}) {
  if (!targetClerkUserId) {
    return <span className="text-xs text-muted">需要先連結 Clerk 才能設定測試點數</span>;
  }

  return (
    <form action={updateUnlimitedCreditsAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="targetClerkUserId" value={targetClerkUserId} />
      <label className="flex items-center gap-2 text-sm text-ink/80">
        <input
          name="unlimitedCredits"
          type="checkbox"
          defaultChecked={enabled}
          className="h-4 w-4 accent-[var(--color-ink)]"
        />
        測試帳戶無限點數
      </label>
      <AdminSubmitButton className="btn-secondary px-3 py-2 text-xs" pendingText="儲存中...">
        儲存
      </AdminSubmitButton>
    </form>
  );
}
