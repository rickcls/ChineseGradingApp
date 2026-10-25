"use client";

import Link from "next/link";
import { useEffect } from "react";

// Shown when a page or server action fails unexpectedly, instead of the bare
// framework error screen.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="paper-panel mx-auto max-w-xl space-y-4 p-6 sm:p-7">
      <p className="section-kicker">出了點問題</p>
      <h1 className="text-2xl">這一頁暫時未能載入</h1>
      <p className="text-sm leading-7 text-ink/75">
        你的資料沒有受影響。可以先重試一次；如果問題持續，請把下面的編號告訴管理員。
      </p>
      {error.digest ? <p className="font-mono text-xs text-muted">錯誤編號：{error.digest}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={reset}>
          重試
        </button>
        <Link href="/dashboard" className="btn-secondary">
          返回主頁
        </Link>
      </div>
    </div>
  );
}
