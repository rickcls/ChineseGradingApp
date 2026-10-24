import type { AdminActionResult } from "@/app/admin/actions";

export function ActionMessage({ result }: { result: AdminActionResult }) {
  if (!result) return null;
  return (
    <p role="status" className={["text-sm", result.ok ? "text-good" : "text-coral"].join(" ")}>
      {result.message}
    </p>
  );
}
