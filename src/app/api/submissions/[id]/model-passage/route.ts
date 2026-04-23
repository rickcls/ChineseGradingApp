import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateModelPassage, serializeModelPassage } from "@/lib/modelPassage";
import { normalizeRevisionPriorities } from "@/lib/revisionPriority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

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
    return NextResponse.json({ error: "這篇文章仍未完成分析，暫時不能生成參考範文。" }, { status: 400 });
  }

  try {
    const generated = await generateModelPassage({
      text: submission.verifiedText,
      gradeLevel: user.gradeLevel,
      genre: submission.task?.genre,
      taskPrompt: submission.task?.promptText || undefined,
      coachFeedbackText: analysis.coachFeedbackText,
      revisionPriorities: normalizeRevisionPriorities(analysis.revisionPriorities),
    });

    const record = await prisma.aiModelPassage.upsert({
      where: { submissionId: submission.id },
      update: {
        generatedText: generated.generatedText,
        highlights: generated.highlights.map(({ id: _id, ...highlight }) => highlight),
        modelName: generated.modelName,
        promptVersion: generated.promptVersion,
      },
      create: {
        userId: user.id,
        submissionId: submission.id,
        generatedText: generated.generatedText,
        highlights: generated.highlights.map(({ id: _id, ...highlight }) => highlight),
        modelName: generated.modelName,
        promptVersion: generated.promptVersion,
      },
    });

    return NextResponse.json({ passage: serializeModelPassage(record) }, { status: 201 });
  } catch (error) {
    console.error("Model passage generation failed", error);
    const rawMessage = error instanceof Error ? error.message : "";
    const message = toUserFacingError(rawMessage);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function toUserFacingError(message: string) {
  if (message.startsWith("MODEL_PASSAGE_PARSE_FAILED:")) {
    return "AI 這次的內容已大致整理好，但格式仍不夠完整；系統已自動補救一次，暫時仍未能顯示。請稍後再試。";
  }

  if (/timed out|timeout/i.test(message)) {
    return "AI 這次整理得比較久，暫時還未完成。請稍後再試一次。";
  }

  if (/403|prohibited|Terms Of Service/i.test(message)) {
    return "AI 這次所用的生成通道暫時不可用，我已改用另一個較穩定的通道。請再按一次重試。";
  }

  return "暫時未能生成參考範文。請稍後再試一次。";
}
