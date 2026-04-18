import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { analyzeSubmission } from "@/lib/analysis";
import { updateWeaknessProfiles } from "@/lib/weakness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  text: z.string().min(20, "文章太短，請至少寫 20 字").max(8000),
  gradeLevel: z.string().optional(),
  taskPrompt: z.string().optional(),
  genre: z.string().optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await getOrCreateUser({ gradeLevel: parsed.data.gradeLevel });
  if (parsed.data.gradeLevel && parsed.data.gradeLevel !== user.gradeLevel) {
    await prisma.user.update({ where: { id: user.id }, data: { gradeLevel: parsed.data.gradeLevel } });
  }

  const submission = await prisma.submission.create({
    data: {
      userId: user.id,
      type: "writing",
      source: "typed",
      rawText: parsed.data.text,
      verifiedText: parsed.data.text,
      status: "verified",
    },
  });

  try {
    const { result, modelName, promptVersion } = await analyzeSubmission({
      text: parsed.data.text,
      gradeLevel: parsed.data.gradeLevel || user.gradeLevel,
      genre: parsed.data.genre,
      taskPrompt: parsed.data.taskPrompt,
    });

    const analysis = await prisma.analysis.create({
      data: {
        submissionId: submission.id,
        scores: result.scores,
        overallScore: result.overall_score,
        modelName,
        promptVersion,
        coachFeedbackText: result.coach_feedback,
        revisionPriorities: result.revision_priorities,
        strengths: result.strengths,
      },
    });

    if (result.errors.length) {
      await prisma.errorRecord.createMany({
        data: result.errors.map((e) => ({
          submissionId: submission.id,
          analysisId: analysis.id,
          category: e.category,
          subcategory: e.subcategory,
          evidenceSpan: e.evidence_span,
          charOffsetStart: e.char_offset_start,
          charOffsetEnd: e.char_offset_end,
          suggestion: e.suggestion,
          severity: e.severity,
          ocrSuspect: false,
          confidence: e.confidence ?? 0.8,
        })),
      });
    }

    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: "analyzed" },
    });

    const persistedErrors = await prisma.errorRecord.findMany({
      where: { submissionId: submission.id },
      select: { category: true, subcategory: true, severity: true, ocrSuspect: true },
    });
    await updateWeaknessProfiles({
      userId: user.id,
      submissionId: submission.id,
      submissionDate: submission.createdAt,
      errors: persistedErrors,
    });

    return NextResponse.json({ id: submission.id }, { status: 201 });
  } catch (err) {
    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: "failed" },
    });
    const message = err instanceof Error ? err.message : "analysis failed";
    return NextResponse.json({ error: message, submissionId: submission.id }, { status: 500 });
  }
}

export async function GET() {
  const user = await getOrCreateUser();
  const subs = await prisma.submission.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { analyses: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return NextResponse.json({ submissions: subs });
}
