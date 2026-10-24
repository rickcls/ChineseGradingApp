import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { countsTowardWeakness, resyncErrorWeakness } from "@/lib/weakness";

export const runtime = "nodejs";

const Body = z.object({
  // null withdraws the student's reaction.
  reaction: z.enum(["helpful", "wrong", "confusing"]).nullable(),
  note: z.string().trim().max(500).optional(),
});

export async function POST(req: Request, props: { params: Promise<{ id: string; errorId: string }> }) {
  const params = await props.params;
  const { appUser: user } = await requireRole(["student", "admin"]);

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const error = await prisma.errorRecord.findFirst({
    where: { id: params.errorId, submissionId: params.id, submission: { userId: user.id } },
    include: { submission: { select: { createdAt: true } } },
  });
  if (!error) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { reaction, note } = parsed.data;
  const countedBefore = countsTowardWeakness(error);
  const countedAfter = countsTowardWeakness({ ...error, studentReaction: reaction });

  await prisma.$transaction(async (tx) => {
    await tx.errorRecord.update({
      where: { id: error.id },
      data: { studentReaction: reaction },
    });
    await tx.feedbackEvent.create({
      data: {
        userId: user.id,
        targetType: "error",
        targetId: error.id,
        reaction: reaction ?? "cleared",
        note: note || null,
      },
    });
    if (countedBefore !== countedAfter) {
      await resyncErrorWeakness({
        userId: user.id,
        submissionId: error.submissionId,
        submissionDate: error.submission.createdAt,
        category: error.category,
        subcategory: error.subcategory,
        delta: countedAfter ? 1 : -1,
        client: tx,
      });
    }
  });

  return NextResponse.json({ reaction });
}
