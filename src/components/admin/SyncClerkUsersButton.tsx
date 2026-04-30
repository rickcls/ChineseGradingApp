"use client";

import { useState, useTransition } from "react";
import { syncClerkUsersAction } from "@/app/admin/actions";

export function SyncClerkUsersButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function handleClick() {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await syncClerkUsersAction();
        setMessage(`同步完成：新建 ${result.created} 人，連結 ${result.linked} 人。`);
      } catch {
        setMessage("同步失敗，請稍後再試。");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-busy={isPending}
        className="btn-secondary text-sm disabled:cursor-wait disabled:opacity-70"
      >
        <span className="inline-flex items-center gap-2">
          {isPending ? <span aria-hidden="true" className="pending-spinner" /> : null}
          <span>{isPending ? "同步中..." : "從 Clerk 同步用戶"}</span>
        </span>
      </button>
      {message ? (
        <span className="text-xs text-muted" aria-live="polite">
          {message}
        </span>
      ) : null}
    </div>
  );
}
