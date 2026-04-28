import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { removeSubmissionFromWeaknessProfiles } from "@/lib/weakness";

export const runtime = "nodejs";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const submission = await prisma.submission.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      errors: { orderBy: { charOffsetStart: "asc" } },
    },
  });
  if (!submission) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ submission });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const submission = await prisma.submission.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      errors: {
        select: {
          category: true,
          subcategory: true,
          severity: true,
          ocrSuspect: true,
        },
      },
    },
  });
  if (!submission) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await removeSubmissionFromWeaknessProfiles({
      userId: user.id,
      submissionId: submission.id,
      errors: submission.errors,
      client: tx,
    });
    await tx.submission.delete({ where: { id: submission.id } });
  });

  return NextResponse.json({ ok: true });
}
