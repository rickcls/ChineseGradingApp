import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { analyzeSubmission } from "@/lib/analysis";
import { deductCreditForSubmission, InsufficientCreditsError, refundCreditForSubmission } from "@/lib/credits";
import { regradeFromAnalysis } from "@/lib/regradeCompare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Re-grade the latest saved revision of a submission (1 credit, refunded on
// failure). The result is stored on the RevisionSession, not as a new
// Submission, so revisions never feed weakness tracking.
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { appUser: user } = await requireRole(["student", "admin"]);

  const submission = await prisma.submission.findFirst({
    where: { id: params.id, userId: user.id },
    include: { revisionOrigin: { orderBy: { createdAt: "desc" }, take: 1 }, task: true },
  });
  if (!submission) return NextResponse.json({ error: "not found" }, { status: 404 });

  const revision = submission.revisionOrigin[0];
  if (!revision) {
    return NextResponse.json({ error: "請先在訂正工作台儲存一份修訂稿。" }, { status: 400 });
  }
  if (revision.regrade) {
    return NextResponse.json({ error: "這份修訂稿已經重新評分；再修改並儲存後可以再評一次。" }, { status: 409 });
  }

  let chargedClerkUserId: string | null = null;
  try {
    const charged = await deductCreditForSubmission("revision_regrade");
    chargedClerkUserId = charged.clerkUserId;

    const outcome = await analyzeSubmission({
      text: revision.revisedText,
      gradeLevel: user.gradeLevel,
      genre: submission.genre || submission.task?.genre || undefined,
      taskPrompt: submission.taskPrompt || submission.task?.promptText || undefined,
    });
    const regrade = regradeFromAnalysis(outcome.result, {
      modelName: outcome.modelName,
      promptVersion: outcome.promptVersion,
      gradedAt: new Date(),
    });
    await prisma.revisionSession.update({ where: { id: revision.id }, data: { regrade } });
    return NextResponse.json({ regrade }, { status: 201 });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    console.error("Revision re-grade failed", error);
    if (chargedClerkUserId) {
      await refundCreditForSubmission(chargedClerkUserId, "revision_regrade_refund").catch((refundError) => {
        console.error("Credit refund failed", refundError);
      });
    }
    return NextResponse.json({ error: "重新評分暫時未能完成，點數已退回，請稍後再試。" }, { status: 500 });
  }
}
