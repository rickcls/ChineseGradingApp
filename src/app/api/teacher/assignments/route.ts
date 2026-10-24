import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { AssignmentInput, dueAtFromDate, teacherClassWhere } from "@/lib/assignments";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { appUser, clerkUserId, role } = await requireRole(["teacher", "admin"]);

  const json = await req.json().catch(() => null);
  const parsed = AssignmentInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { classId, taskPrompt, genre, instructions, dueDate } = parsed.data;
  const klass = await prisma.class.findFirst({
    where: { id: classId, ...teacherClassWhere({ clerkUserId, isAdmin: role === "admin" }) },
    select: { id: true },
  });
  if (!klass) return NextResponse.json({ error: "not found" }, { status: 404 });

  const assignment = await prisma.assignment.create({
    data: {
      classId: klass.id,
      createdByUserId: appUser.id,
      taskPrompt,
      genre: genre || null,
      instructions: instructions || null,
      dueAt: dueDate ? dueAtFromDate(dueDate) : null,
    },
  });

  return NextResponse.json({ id: assignment.id }, { status: 201 });
}
