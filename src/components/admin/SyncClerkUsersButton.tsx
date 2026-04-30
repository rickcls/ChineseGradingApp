"use client";

import { useTransition } from "react";
import { syncClerkUsersAction } from "@/app/admin/actions";

export function SyncClerkUsersButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await syncClerkUsersAction();
      alert(`同步完成：新建 ${result.created} 人，連結 ${result.linked} 人。`);
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className="btn-secondary text-sm">
      {isPending ? "同步中…" : "從 Clerk 同步用戶"}
    </button>
  );
}
