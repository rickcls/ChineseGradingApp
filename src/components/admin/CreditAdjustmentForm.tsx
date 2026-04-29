import { adjustCreditsAction } from "@/app/admin/actions";

export function CreditAdjustmentForm({ targetClerkUserId }: { targetClerkUserId: string | null }) {
  if (!targetClerkUserId) {
    return <span className="text-xs text-muted">需要先連結 Clerk 才能調整點數</span>;
  }

  return (
    <form action={adjustCreditsAction} className="grid gap-2 sm:grid-cols-[6rem_7rem_minmax(9rem,1fr)_auto]">
      <input type="hidden" name="targetClerkUserId" value={targetClerkUserId} />
      <input
        name="amount"
        type="number"
        min="1"
        step="1"
        defaultValue="1"
        className="field-input min-h-0 py-2 text-sm"
        aria-label="點數數量"
      />
      <select name="mode" defaultValue="add" className="field-input min-h-0 py-2 text-sm" aria-label="調整方式">
        <option value="add">增加</option>
        <option value="remove">扣除</option>
      </select>
      <input
        name="reason"
        defaultValue="admin_adjustment"
        className="field-input min-h-0 py-2 text-sm"
        aria-label="點數調整原因"
      />
      <button type="submit" className="btn-secondary px-3 py-2 text-xs">
        儲存點數
      </button>
    </form>
  );
}
