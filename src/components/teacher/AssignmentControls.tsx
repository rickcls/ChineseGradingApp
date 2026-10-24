"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AssignmentControlsProps = {
  assignmentId: string;
  modelPassageReleased: boolean;
};

export function AssignmentControls({ assignmentId, modelPassageReleased }: AssignmentControlsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error("操作未能完成，請稍後再試。");
      if (method === "DELETE") router.push("/teacher/dashboard");
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作未能完成，請稍後再試。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={modelPassageReleased ? "btn-secondary" : "btn-primary"}
          disabled={busy}
          onClick={() => send("PATCH", { modelPassageReleased: !modelPassageReleased })}
        >
          {modelPassageReleased ? "重新鎖上 AI 參考範文" : "開放 AI 參考範文"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => {
            if (window.confirm("刪除這份任務？學生已交的文章會保留，只是不再連到這份任務。")) send("DELETE");
          }}
        >
          刪除任務
        </button>
      </div>
      <p className="text-xs text-muted">
        {modelPassageReleased
          ? "學生現在可以在作品頁生成 AI 參考範文。"
          : "學生暫時看不到 AI 參考範文。建議在大家交稿並訂正後才開放。"}
      </p>
      {error ? <p className="text-sm text-coral">{error}</p> : null}
    </div>
  );
}
