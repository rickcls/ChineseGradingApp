import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { normalizeRevisionPriorities } from "@/lib/revisionPriority";
import { generateThemeElevation } from "@/lib/themeElevation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { appUser: user } = await requireRole(["student", "admin"]);

  const submission = await prisma.submission.findFirst({
    where: { id: params.id, userId: user.id },
    include: { analyses: { orderBy: { createdAt: "desc" }, take: 1 }, task: true },
  });
  if (!submission) return NextResponse.json({ error: "not found" }, { status: 404 });

  const analysis = submission.analyses[0];
  if (!analysis) {
    return NextResponse.json({ error: "這篇文章仍未完成分析，暫時不能生成立意昇華建議。" }, { status: 400 });
  }

  try {
    const elevation = await generateThemeElevation({
      text: submission.verifiedText,
      gradeLevel: user.gradeLevel,
      genre: submission.genre || submission.task?.genre,
      taskPrompt: submission.taskPrompt || submission.task?.promptText || undefined,
      coachFeedbackText: analysis.coachFeedbackText,
      revisionPriorities: normalizeRevisionPriorities(analysis.revisionPriorities),
    });
    await prisma.analysis.update({ where: { id: analysis.id }, data: { themeElevation: elevation } });
    return NextResponse.json({ elevation }, { status: 201 });
  } catch (error) {
    console.error("Theme elevation failed", error);
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        error: /timed out|timeout/i.test(message)
          ? "AI 這次整理得比較久，請稍後再試一次。"
          : "暫時未能生成立意昇華建議，請稍後再試。",
      },
      { status: 500 },
    );
  }
}
