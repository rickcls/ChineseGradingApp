"use client";

import { useActionState, useEffect, useState } from "react";
import { type UserRole } from "@prisma/client";
import { saveUserAction } from "@/app/admin/actions";
import { ActionMessage } from "@/components/admin/ActionMessage";
import { ADMIN_CREDIT_REASONS } from "@/lib/creditReasons";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "student", label: "學生" },
  { value: "teacher", label: "老師" },
  { value: "admin", label: "管理員" },
];

type UserManageFormProps = {
  user: { clerkUserId: string; name: string; role: UserRole; credits: number; unlimitedCredits: boolean };
  isSelf: boolean;
};

// Role, unlimited credits and a credit change, saved together with one button.
export function UserManageForm({ user, isSelf }: UserManageFormProps) {
  const [result, formAction, pending] = useActionState(saveUserAction, null);
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<"add" | "remove">("add");

  useEffect(() => {
    if (result?.ok) setAmount(0);
  }, [result]);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="targetClerkUserId" value={user.clerkUserId} />

      <label className="block">
        <span className="field-label">角色</span>
        <select name="role" defaultValue={user.role} disabled={isSelf} className="field-input min-h-0 py-2 text-sm">
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {isSelf ? (
          <>
            <input type="hidden" name="role" value={user.role} />
            <span className="mt-1 block text-xs text-muted">不能更改自己的角色。</span>
          </>
        ) : null}
      </label>

      <div>
        <span className="field-label">點數（目前 {user.credits} 點）</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-full border border-border">
            {(["add", "remove"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={["px-3 py-1.5 text-xs", mode === value ? "bg-ink text-white" : "bg-white text-ink/80"].join(" ")}
              >
                {value === "add" ? "增加" : "扣除"}
              </button>
            ))}
          </div>
          <input type="hidden" name="creditMode" value={mode} />
          {[1, 5, 10].map((step) => (
            <button key={step} type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setAmount((current) => current + step)}>
              +{step}
            </button>
          ))}
          <input
            name="creditAmount"
            type="number"
            min={0}
            max={1000}
            value={amount}
            onChange={(event) => setAmount(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
            className="field-input min-h-0 w-20 py-1.5 text-sm"
            aria-label="點數數量"
          />
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select name="creditReason" defaultValue="class_distribution" className="field-input min-h-0 py-2 text-sm" aria-label="原因">
            {ADMIN_CREDIT_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
          <input name="creditNote" maxLength={120} placeholder="備註（可選）" className="field-input min-h-0 py-2 text-sm" />
        </div>
        {amount > 0 ? (
          <p className="mt-1 text-xs text-muted">
            儲存後：{mode === "add" ? user.credits + amount : Math.max(0, user.credits - amount)} 點
          </p>
        ) : null}
      </div>

      <label className="flex items-start gap-2 text-sm text-ink/80">
        <input name="unlimitedCredits" type="checkbox" defaultChecked={user.unlimitedCredits} className="mt-1 h-4 w-4" />
        <span>
          無限點數
          <span className="block text-xs text-muted">開啟後提交文章不會扣點，適合老師或測試帳戶。管理員本身不會被扣點。</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending} aria-busy={pending}>
          {pending ? "儲存中…" : "儲存變更"}
        </button>
        <ActionMessage result={result} />
      </div>
    </form>
  );
}
