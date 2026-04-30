"use client";

import { useFormStatus } from "react-dom";

export function AdminSubmitButton({
  children,
  pendingText,
  className = "btn-secondary",
}: {
  children: string;
  pendingText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className} disabled:cursor-wait disabled:opacity-70`}
    >
      <span className="inline-flex items-center gap-2">
        {pending ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
        <span>{pending ? pendingText : children}</span>
      </span>
    </button>
  );
}
