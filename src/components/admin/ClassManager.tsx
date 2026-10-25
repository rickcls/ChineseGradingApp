"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  addStudentsToClassAction,
  createClassAction,
  deleteClassAction,
  grantClassCreditsAction,
  removeStudentFromClassAction,
  updateClassAction,
} from "@/app/admin/actions";
import { ActionMessage } from "@/components/admin/ActionMessage";
import { ADMIN_CREDIT_REASONS } from "@/lib/creditReasons";

type Person = { clerkUserId: string; name: string; email: string | null };

export type ManagedClass = {
  id: string;
  name: string;
  teacherClerkUserId: string;
  teacherName: string;
  students: Person[];
};

type ClassManagerProps = {
  classes: ManagedClass[];
  teachers: Person[];
  students: Person[];
};

export function ClassManager({ classes, teachers, students }: ClassManagerProps) {
  return (
    <div className="space-y-5">
      <CreateClassForm teachers={teachers} />
      {classes.length === 0 ? (
        <div className="paper-panel p-5 text-sm text-muted">尚未建立班級。</div>
      ) : (
        classes.map((klass) => <ClassCard key={klass.id} klass={klass} teachers={teachers} students={students} />)
      )}
    </div>
  );
}

function TeacherSelect({ teachers, defaultValue }: { teachers: Person[]; defaultValue?: string }) {
  return (
    <select name="teacherClerkUserId" required defaultValue={defaultValue ?? ""} className="field-input">
      <option value="" disabled>
        選擇老師
      </option>
      {teachers.map((teacher) => (
        <option key={teacher.clerkUserId} value={teacher.clerkUserId}>
          {teacher.name}
        </option>
      ))}
    </select>
  );
}

function CreateClassForm({ teachers }: { teachers: Person[] }) {
  const [result, formAction, pending] = useActionState(createClassAction, null);
  return (
    <form action={formAction} className="paper-panel grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <label className="block">
        <span className="field-label">新班級名稱</span>
        <input name="name" required placeholder="例：S3 中文寫作班" className="field-input" />
      </label>
      <label className="block">
        <span className="field-label">老師</span>
        <TeacherSelect teachers={teachers} />
      </label>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "建立中…" : "建立班級"}
      </button>
      {teachers.length === 0 ? (
        <p className="text-xs text-muted md:col-span-3">還沒有老師帳戶：先在「用戶與點數」把一位用戶的角色改為老師。</p>
      ) : null}
      <div className="md:col-span-3">
        <ActionMessage result={result} />
      </div>
    </form>
  );
}

function ClassCard({ klass, teachers, students }: { klass: ManagedClass; teachers: Person[]; students: Person[] }) {
  return (
    <article className="paper-panel space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl text-ink">{klass.name}</h3>
          <p className="mt-1 text-sm text-muted">
            老師：{klass.teacherName}・{klass.students.length} 位學生
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <p className="field-label">學生</p>
          {klass.students.length === 0 ? (
            <p className="text-sm text-muted">尚未加入學生。</p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-auto pr-1">
              {klass.students.map((student) => (
                <li key={student.clerkUserId} className="flex items-center justify-between gap-2 rounded-[0.8rem] bg-white/70 px-3 py-1.5 text-sm">
                  <span className="text-ink">
                    {student.name}
                    {student.email ? <span className="ml-2 text-xs text-muted">{student.email}</span> : null}
                  </span>
                  <RemoveStudentButton classId={klass.id} student={student} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <AddStudentsForm klass={klass} students={students} />
      </div>

      <ClassCreditsForm klass={klass} />

      <details className="rounded-[1rem] border border-border/70 bg-white/60 px-4 py-3">
        <summary className="cursor-pointer text-sm text-ink/80">更改班級名稱、老師或刪除班級</summary>
        <EditClassForm klass={klass} teachers={teachers} />
      </details>
    </article>
  );
}

function RemoveStudentButton({ classId, student }: { classId: string; student: Person }) {
  const [result, formAction, pending] = useActionState(removeStudentFromClassAction, null);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="studentClerkUserId" value={student.clerkUserId} />
      {result && !result.ok ? <span className="text-xs text-coral">{result.message}</span> : null}
      <button type="submit" className="text-xs text-muted hover:text-coral" disabled={pending} aria-label={`把 ${student.name} 移出班級`}>
        {pending ? "移除中…" : "移出"}
      </button>
    </form>
  );
}

function AddStudentsForm({ klass, students }: { klass: ManagedClass; students: Person[] }) {
  const [result, formAction, pending] = useActionState(addStudentsToClassAction, null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (result?.ok) setSelected([]);
  }, [result]);

  const enrolled = useMemo(() => new Set(klass.students.map((student) => student.clerkUserId)), [klass.students]);
  const candidates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return students
      .filter((student) => !enrolled.has(student.clerkUserId))
      .filter((student) => !normalized || `${student.name} ${student.email ?? ""}`.toLowerCase().includes(normalized));
  }, [students, enrolled, query]);

  function toggle(clerkUserId: string) {
    setSelected((current) => (current.includes(clerkUserId) ? current.filter((id) => id !== clerkUserId) : [...current, clerkUserId]));
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="classId" value={klass.id} />
      {selected.map((clerkUserId) => (
        <input key={clerkUserId} type="hidden" name="studentClerkUserId" value={clerkUserId} />
      ))}
      <label className="block">
        <span className="field-label">加入學生</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋姓名或電郵" className="field-input min-h-0 py-2 text-sm" />
      </label>
      <ul className="max-h-48 space-y-1 overflow-auto rounded-[0.8rem] border border-border/60 bg-white/70 p-2">
        {candidates.length === 0 ? (
          <li className="px-2 py-1 text-sm text-muted">{query ? "找不到符合的學生。" : "所有學生都已在這個班。"}</li>
        ) : (
          candidates.slice(0, 100).map((student) => (
            <li key={student.clerkUserId}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-mist/50">
                <input type="checkbox" checked={selected.includes(student.clerkUserId)} onChange={() => toggle(student.clerkUserId)} />
                <span className="text-ink">{student.name}</span>
                {student.email ? <span className="text-xs text-muted">{student.email}</span> : null}
              </label>
            </li>
          ))
        )}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-secondary" disabled={pending || selected.length === 0}>
          {pending ? "加入中…" : `加入所選（${selected.length}）`}
        </button>
        <ActionMessage result={result} />
      </div>
    </form>
  );
}

function ClassCreditsForm({ klass }: { klass: ManagedClass }) {
  const [result, formAction, pending] = useActionState(grantClassCreditsAction, null);
  const [amount, setAmount] = useState(5);
  return (
    <form action={formAction} className="rounded-[1rem] border border-border/70 bg-white/60 p-4">
      <input type="hidden" name="classId" value={klass.id} />
      <p className="field-label">全班加點</p>
      <div className="grid gap-2 sm:grid-cols-[6rem_1fr_1fr_auto] sm:items-center">
        <input
          name="creditAmount"
          type="number"
          min={1}
          max={1000}
          value={amount}
          onChange={(event) => setAmount(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
          className="field-input min-h-0 py-2 text-sm"
          aria-label="每位學生的點數"
        />
        <select name="creditReason" defaultValue="class_distribution" className="field-input min-h-0 py-2 text-sm" aria-label="原因">
          {ADMIN_CREDIT_REASONS.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>
        <input name="creditNote" maxLength={120} placeholder="備註（可選）" className="field-input min-h-0 py-2 text-sm" />
        <button
          type="submit"
          className="btn-secondary"
          disabled={pending || klass.students.length === 0}
          onClick={(event) => {
            if (!window.confirm(`為「${klass.name}」${klass.students.length} 位學生各增加 ${amount} 點？`)) event.preventDefault();
          }}
        >
          {pending ? "處理中…" : `每人加 ${amount} 點`}
        </button>
      </div>
      <div className="mt-2">
        <ActionMessage result={result} />
      </div>
    </form>
  );
}

function EditClassForm({ klass, teachers }: { klass: ManagedClass; teachers: Person[] }) {
  const [updateResult, updateAction, updating] = useActionState(updateClassAction, null);
  const [deleteResult, deleteAction, deleting] = useActionState(deleteClassAction, null);
  return (
    <div className="mt-3 space-y-4">
      <form action={updateAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <input type="hidden" name="classId" value={klass.id} />
        <label className="block">
          <span className="field-label">班級名稱</span>
          <input name="name" required defaultValue={klass.name} className="field-input" />
        </label>
        <label className="block">
          <span className="field-label">老師</span>
          <TeacherSelect teachers={teachers} defaultValue={klass.teacherClerkUserId} />
        </label>
        <button type="submit" className="btn-secondary" disabled={updating}>
          {updating ? "儲存中…" : "儲存"}
        </button>
        <div className="md:col-span-3">
          <ActionMessage result={updateResult} />
        </div>
      </form>
      <form action={deleteAction} className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
        <input type="hidden" name="classId" value={klass.id} />
        <button
          type="submit"
          className="btn-secondary text-coral"
          disabled={deleting}
          onClick={(event) => {
            if (!window.confirm(`刪除「${klass.name}」？班級的寫作任務也會一併刪除；學生的文章和點數會保留。`)) event.preventDefault();
          }}
        >
          {deleting ? "刪除中…" : "刪除班級"}
        </button>
        <span className="text-xs text-muted">班級的寫作任務會一併刪除；學生的文章和點數會保留。</span>
        <ActionMessage result={deleteResult} />
      </form>
    </div>
  );
}
