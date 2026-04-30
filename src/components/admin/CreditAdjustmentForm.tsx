import { adjustCreditsAction } from "@/app/admin/actions";

export function CreditAdjustmentForm({ targetClerkUserId }: { targetClerkUserId: string | null }) {
  if (!targetClerkUserId) {
    return <span className="text-xs text-muted">需要先連結 Clerk 才能調整點數</span>;
  }

  return (
    <form action={adjustCreditsAction} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <input type="hidden" name="targetClerkUserId" value={targetClerkUserId} />
      <input
        name="amount"
        type="number"
        min="1"
        step="1"
        defaultValue="1"
        className="field-input min-h-0 min-w-0 py-2 text-sm"
        aria-label="點數數量"
      />
      <select name="mode" defaultValue="add" className="field-input min-h-0 min-w-0 py-2 text-sm" aria-label="調整方式">
        <option value="add">增加</option>
        <option value="remove">扣除</option>
      </select>
      <input
        name="reason"
        defaultValue="admin_adjustment"
        className="field-input min-h-0 min-w-0 py-2 text-sm sm:col-span-2"
        aria-label="點數調整原因"
      />
      <button type="submit" className="btn-secondary w-full px-3 py-2 text-xs sm:col-span-2 sm:w-auto">
        儲存點數
      </button>
    </form>
  );
}
