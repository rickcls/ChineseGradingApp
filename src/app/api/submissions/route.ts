import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { analyzeSubmission } from "@/lib/analysis";
import { updateWeaknessProfiles } from "@/lib/weakness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({
  text: z.string().min(20, "文章太短，請至少寫 20 字").max(8000),
  gradeLevel: z.string().optional(),
  taskPrompt: z.string().optional(),
  genre: z.string().optional(),
  source: z.enum(["typed", "photo", "scan"]).optional(),
  stream: z.boolean().optional(),
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

  if (parsed.data.stream) {
    return streamingResponse(parsed.data, user.id);
  }

  return jsonResponse(parsed.data, user.id);
}

type Body = z.infer<typeof Body>;

async function jsonResponse(body: Body, userId: string) {
  let submissionId: string | null = null;
  try {
    const submissionPromise = prisma.submission
      .create({
        data: {
          userId,
          type: "writing",
          source: body.source || "typed",
          rawText: body.text,
          verifiedText: body.text,
          status: "verified",
        },
      })
      .then((submission) => {
        submissionId = submission.id;
        return submission;
      });
    const analysisPromise = analyzeSubmission({
      text: body.text,
      gradeLevel: body.gradeLevel || "S2",
      genre: body.genre,
      taskPrompt: body.taskPrompt,
    });

    const [submission, analysisOutcome] = await Promise.all([submissionPromise, analysisPromise]);

    await persistAnalysis(submission, analysisOutcome, userId);
    return NextResponse.json({ id: submission.id }, { status: 201 });
  } catch (err) {
    console.error("Submission analysis failed", err);
    await markFailed(submissionId);
    return NextResponse.json(
      { error: formatError(err), submissionId: submissionId || undefined },
      { status: 500 },
    );
  }
}

function streamingResponse(body: Body, userId: string) {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      let submissionId: string | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      try {
        send({ type: "start" });

        const submissionPromise = prisma.submission
          .create({
            data: {
              userId,
              type: "writing",
              source: body.source || "typed",
              rawText: body.text,
              verifiedText: body.text,
              status: "verified",
            },
          })
          .then((submission) => {
            submissionId = submission.id;
            return submission;
          });

        let streamedChars = 0;
        let lastProgressAt = 0;
        const analysisPromise = analyzeSubmission(
          {
            text: body.text,
            gradeLevel: body.gradeLevel || "S2",
            genre: body.genre,
            taskPrompt: body.taskPrompt,
          },
          {
            onChunk: (chunk) => {
              streamedChars += chunk.length;
              // Throttle: at most one progress event per 250ms.
              const now = Date.now();
              if (now - lastProgressAt >= 250) {
                lastProgressAt = now;
                send({ type: "progress", chars: streamedChars });
              }
            },
          },
        );

        // Some proxies buffer SSE; emit a periodic heartbeat to keep the
        // connection alive while the LLM is still generating.
        heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        }, 10_000);

        const [submission, analysisOutcome] = await Promise.all([submissionPromise, analysisPromise]);

        send({ type: "progress", chars: streamedChars, phase: "persisting" });
        await persistAnalysis(submission, analysisOutcome, userId);
        send({ type: "done", id: submission.id });
      } catch (err) {
        console.error("Submission analysis failed", err);
        await markFailed(submissionId);
        send({ type: "error", message: formatError(err), submissionId: submissionId || undefined });
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

type AnalyzeOutcome = Awaited<ReturnType<typeof analyzeSubmission>>;
type SubmissionRow = Awaited<ReturnType<typeof prisma.submission.create>>;

async function persistAnalysis(
  submission: SubmissionRow,
  outcome: AnalyzeOutcome,
  userId: string,
) {
  const { result, modelName, promptVersion } = outcome;

  const analysis = await prisma.analysis.create({
    data: {
      submissionId: submission.id,
      scores: {
        ...result.scores,
        word_count: result.word_count,
        typo_count: result.typo_count,
        typo_bonus: result.typo_bonus,
        base_score: result.base_score,
        dse_level: result.dse_level,
      },
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
        exampleFix: e.example_fix ?? null,
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

  // The typed path never marks an error as ocrSuspect, so the in-memory
  // result.errors is the exact input the aggregator needs — saves one DB
  // roundtrip compared to re-reading the rows we just wrote.
  await updateWeaknessProfiles({
    userId,
    submissionId: submission.id,
    submissionDate: submission.createdAt,
    errors: result.errors.map((e) => ({
      category: e.category,
      subcategory: e.subcategory,
      severity: e.severity,
      ocrSuspect: false,
    })),
  });
}

async function markFailed(submissionId: string | null) {
  if (!submissionId) return;
  await prisma.submission
    .update({ where: { id: submissionId }, data: { status: "failed" } })
    .catch(() => null);
}

function formatError(err: unknown) {
  if (err instanceof z.ZodError) return "分析結果格式暫時不完整，請稍後再試。";
  if (err instanceof Error) return err.message;
  return "analysis failed";
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
