import Link from "next/link";
import { StatePanel } from "@/components/StatePanel";

export default function NotFound() {
  return (
    <div className="space-y-4">
      <StatePanel
        state="empty"
        title="這一頁暫時找不到了"
        description="可能是連結已過期，或者這篇文章還沒有屬於你的記錄。先回到主頁，我們再從那裡繼續。"
        actionHref="/"
        actionLabel="返回主頁"
      />
      <Link href="/submissions/new" className="btn-secondary inline-flex">
        交一篇新文章
      </Link>
    </div>
  );
}
