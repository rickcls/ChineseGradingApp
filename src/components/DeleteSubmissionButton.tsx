"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteSubmissionButtonProps = {
  submissionId: string;
  className?: string;
};

export function DeleteSubmissionButton({ submissionId, className }: DeleteSubmissionButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (isDeleting) return;
    const confirmed = window.confirm("確定要刪除這篇文章嗎？刪除後，相關批改、修訂對照和 AI 參考範文也會一併移除。");
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/submissions/${submissionId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "暫時未能刪除，請稍後再試。");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "暫時未能刪除，請稍後再試。");
      setIsDeleting(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-busy={isDeleting}
        className={
          className ||
          "inline-flex items-center justify-center rounded-full border border-coral/30 bg-coral/10 px-4 py-2 text-sm font-medium text-coral transition duration-150 hover:bg-coral/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-coral/10 active:translate-y-px active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0 disabled:active:scale-100"
        }
      >
        <span className="inline-flex items-center gap-2">
          {isDeleting ? <span aria-hidden="true" className="pending-spinner" /> : null}
          <span>{isDeleting ? "刪除中…" : "刪除"}</span>
        </span>
      </button>
      {error ? <span className="max-w-48 text-xs leading-5 text-coral">{error}</span> : null}
    </div>
  );
}
