import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateNotebookNoteDraft } from "@/lib/notebookNote";
import { normalizeFocusTag } from "@/lib/notebook";
import { normalizeRevisionPriorities } from "@/lib/revisionPriority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const requestedFocusTag = normalizeFocusTag(
    typeof body?.focusTag === "string" ? body.focusTag : undefined,
  );

  const submission = await prisma.submission.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      task: true,
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const analysis = submission.analyses[0];
  if (!analysis) {
    return NextResponse.json(
      { error: "這篇文章仍未完成分析，暫時不能生成筆記。" },
      { status: 400 },
    );
  }

  try {
    const draft = await generateNotebookNoteDraft({
      text: submission.verifiedText,
      gradeLevel: user.gradeLevel,
      genre: submission.task?.genre,
      taskPrompt: submission.task?.promptText || undefined,
      coachFeedbackText: analysis.coachFeedbackText,
      strengths: normalizeStringArray(analysis.strengths),
      revisionPriorities: normalizeRevisionPriorities(analysis.revisionPriorities),
      requestedFocusTag,
    });

    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    console.error("Notebook note generation failed", error);
    return NextResponse.json({ error: toUserFacingError(error) }, { status: 500 });
  }
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function toUserFacingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/timed out|timeout/i.test(message)) {
    return "AI 這次整理得比較久，暫時還未完成。請稍後再試一次。";
  }

  if (/JSON|parse|invalid/i.test(message)) {
    return "AI 這次已整理出筆記方向，但格式不夠完整。請再試一次。";
  }

  return "暫時未能生成筆記草稿。請稍後再試一次。";
}
