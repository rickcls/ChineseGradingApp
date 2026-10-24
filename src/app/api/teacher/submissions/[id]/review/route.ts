import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { TeacherReviewInput, teacherSubmissionScope } from "@/lib/teacherReview";

export const runtime = "nodejs";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { appUser, clerkUserId, role } = await requireRole(["teacher", "admin"]);

  const json = await req.json().catch(() => null);
  const parsed = TeacherReviewInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const scope = await teacherSubmissionScope({ clerkUserId, isAdmin: role === "admin" });
  if (!scope) return NextResponse.json({ error: "not found" }, { status: 404 });

  const submission = await prisma.submission.findFirst({
    where: { id: params.id, ...scope },
    include: { analyses: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } },
  });
  if (!submission) return NextResponse.json({ error: "not found" }, { status: 404 });

  const analysis = submission.analyses[0];
  if (!analysis) {
    return NextResponse.json({ error: "這篇作品仍未完成 AI 分析，暫時不能覆核。" }, { status: 400 });
  }

  const { scores, typoCount, dseLevel, comment } = parsed.data;
  const data = {
    scores,
    typoCount: typoCount ?? null,
    dseLevel,
    comment: comment || null,
  };

  const review = await prisma.teacherReview.upsert({
    where: { analysisId_reviewerUserId: { analysisId: analysis.id, reviewerUserId: appUser.id } },
    create: {
      ...data,
      submissionId: submission.id,
      analysisId: analysis.id,
      reviewerUserId: appUser.id,
    },
    update: data,
  });

  return NextResponse.json({ id: review.id }, { status: 201 });
}
