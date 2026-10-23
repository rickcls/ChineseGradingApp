import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import {
  TOPIC_ANALYSIS_DAILY_LIMIT,
  TOPIC_ANALYSIS_MODEL,
  TOPIC_ANALYSIS_PROMPT_VERSION,
  generateTopicAnalysis,
  isTopicAnalysisResult,
  normalizeTopic,
} from "@/lib/topicAnalysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  taskPrompt: z.string().min(2, "請先輸入題目").max(300),
  genre: z.string().trim().max(20).optional(),
  gradeLevel: z.string().trim().max(10).optional(),
});

export async function POST(req: Request) {
  const { appUser: user } = await requireRole(["student", "admin"]);

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const taskPrompt = normalizeTopic(parsed.data.taskPrompt);
  const genre = parsed.data.genre || null;
  const gradeLevel = parsed.data.gradeLevel || user.gradeLevel;

  const cached = await prisma.topicAnalysis.findFirst({
    where: { userId: user.id, taskPrompt, genre, promptVersion: TOPIC_ANALYSIS_PROMPT_VERSION },
    orderBy: { createdAt: "desc" },
  });
  if (cached && isTopicAnalysisResult(cached.result)) {
    return NextResponse.json({ analysis: cached.result, cached: true });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const usedToday = await prisma.topicAnalysis.count({ where: { userId: user.id, createdAt: { gte: since } } });
  if (usedToday >= TOPIC_ANALYSIS_DAILY_LIMIT) {
    return NextResponse.json(
      { error: `今天已審題 ${usedToday} 次，請明天再試，或先動筆寫一篇。` },
      { status: 429 },
    );
  }

  try {
    const analysis = await generateTopicAnalysis({ taskPrompt, genre: genre ?? undefined, gradeLevel });
    await prisma.topicAnalysis.create({
      data: {
        userId: user.id,
        taskPrompt,
        genre,
        gradeLevel,
        result: analysis,
        modelName: TOPIC_ANALYSIS_MODEL,
        promptVersion: TOPIC_ANALYSIS_PROMPT_VERSION,
      },
    });
    return NextResponse.json({ analysis, cached: false }, { status: 201 });
  } catch (error) {
    console.error("Topic analysis failed", error);
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        error: /timed out|timeout/i.test(message)
          ? "AI 這次審題比較久，請稍後再試一次。"
          : "暫時未能完成審題，請稍後再試。",
      },
      { status: 500 },
    );
  }
}
