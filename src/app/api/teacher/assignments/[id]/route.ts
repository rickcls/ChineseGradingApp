import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { AssignmentUpdate, dueAtFromDate, teacherClassWhere } from "@/lib/assignments";

export const runtime = "nodejs";

async function findOwnAssignment(id: string) {
  const { clerkUserId, role } = await requireRole(["teacher", "admin"]);
  return prisma.assignment.findFirst({
    where: { id, class: teacherClassWhere({ clerkUserId, isAdmin: role === "admin" }) },
    select: { id: true },
  });
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const assignment = await findOwnAssignment(params.id);
  if (!assignment) return NextResponse.json({ error: "not found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = AssignmentUpdate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { modelPassageReleased, dueDate } = parsed.data;
  await prisma.assignment.update({
    where: { id: assignment.id },
    data: {
      ...(modelPassageReleased !== undefined ? { modelPassageReleased } : {}),
      ...(dueDate !== undefined ? { dueAt: dueDate ? dueAtFromDate(dueDate) : null } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

// Students' essays are kept; they just stop being linked to the assignment.
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const assignment = await findOwnAssignment(params.id);
  if (!assignment) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.assignment.delete({ where: { id: assignment.id } });
  return NextResponse.json({ ok: true });
}
