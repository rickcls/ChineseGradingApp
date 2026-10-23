import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { analyzeSubmission } from "@/lib/analysis";
import {
  deductCreditForSubmission,
  InsufficientCreditsError,
  refundCreditForSubmission,
} from "@/lib/credits";
import { buildOcrSuspectChecker } from "@/lib/ocrSuspect";
import { updateWeaknessProfiles } from "@/lib/weakness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({
  text: z.string().min(20, "文章太短，請至少寫 20 字").max(8000),
  gradeLevel: z.string().optional(),
  taskPrompt: z.string().trim().max(500).optional(),
  genre: z.string().trim().max(20).optional(),
  // Untouched OCR transcript for photo/scan; `text` is the student-verified version.
  ocrText: z.string().max(8000).optional(),
  source: z.enum(["typed", "photo", "scan"]).optional(),
  stream: z.boolean().optional(),
});

type Body = z.infer<typeof Body>;

export async function POST(req: Request) {
  const { appUser: user } = await requireRole(["student", "admin"]);
  
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.gradeLevel && parsed.data.gradeLevel !== user.gradeLevel) {
    await prisma.appUser.update({ where: { id: user.id }, data: { gradeLevel: parsed.data.gradeLevel } });
  }

  const gradeLevel = parsed.data.gradeLevel || user.gradeLevel;

  if (parsed.data.stream) {
    return streamingResponse(parsed.data, user.id, gradeLevel);
  }

  return jsonResponse(parsed.data, user.id, gradeLevel);
}

function submissionData(body: Body, userId: string) {
  const source = body.source || "typed";
  return {
    userId,
    type: "writing" as const,
    source,
    rawText: source !== "typed" && body.ocrText ? body.ocrText : body.text,
    verifiedText: body.text,
    taskPrompt: body.taskPrompt || null,
    genre: body.genre || null,
    status: "verified" as const,
  };
}

async function jsonResponse(body: Body, userId: string, gradeLevel: string) {
  let submissionId: string | null = null;
  let chargedClerkUserId: string | null = null;

  try {
    const user = await deductCreditForSubmission();
    chargedClerkUserId = user.clerkUserId;

    const submission = await prisma.submission.create({
      data: submissionData(body, user.id),
    });
    submissionId = submission.id;

    const analysisOutcome = await analyzeSubmission({
      text: body.text,
      gradeLevel,
      genre: body.genre || undefined,
      taskPrompt: body.taskPrompt || undefined,
    });

    await persistAnalysis(submission, analysisOutcome, userId);
    return NextResponse.json({ id: submission.id }, { status: 201 });
  } catch (err) {
    console.error("Submission analysis failed", err);
    
    if (submissionId) {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: "failed" },
      }).catch(() => null);
    }

    if (chargedClerkUserId && !(err instanceof InsufficientCreditsError)) {
      await refundCreditForSubmission(chargedClerkUserId, "essay_submission_refund").catch((refundError) => {
        console.error("Credit refund failed", refundError);
      });
    }

    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }

    return NextResponse.json(
      { error: formatError(err), submissionId: submissionId || undefined },
      { status: 500 },
    );
  }
}

async function streamingResponse(body: Body, userId: string, gradeLevel: string) {
  const encoder = new TextEncoder();
  let chargedClerkUserId: string | null = null;

  const readable = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      let submissionId: string | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      try {
        send({ type: "start" });

        const user = await deductCreditForSubmission();
        chargedClerkUserId = user.clerkUserId;

        const submissionPromise = prisma.submission.create({
          data: submissionData(body, userId),
        }).then((s) => {
          submissionId = s.id;
          return s;
        });

        let streamedChars = 0;
        let lastProgressAt = 0;
        const analysisPromise = analyzeSubmission(
          {
            text: body.text,
            gradeLevel,
            genre: body.genre || undefined,
            taskPrompt: body.taskPrompt || undefined,
          },
          {
            onChunk: (chunk) => {
              streamedChars += chunk.length;
              const now = Date.now();
              if (now - lastProgressAt >= 250) {
                lastProgressAt = now;
                send({ type: "progress", chars: streamedChars });
              }
            },
          },
        );

        heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        }, 10_000);

        const [submission, analysisOutcome] = await Promise.all([submissionPromise, analysisPromise]);

        send({ type: "progress", chars: streamedChars, phase: "persisting" });
        await persistAnalysis(submission, analysisOutcome, userId);
        send({ type: "done", id: submission.id });
      } catch (err) {
        console.error("Submission analysis failed", err);
        
        if (submissionId) {
          await prisma.submission.update({
            where: { id: submissionId },
            data: { status: "failed" },
          }).catch(() => null);
        }

        if (chargedClerkUserId && !(err instanceof InsufficientCreditsError)) {
          await refundCreditForSubmission(chargedClerkUserId, "essay_submission_refund").catch(() => null);
        }

        const message = err instanceof InsufficientCreditsError ? err.message : formatError(err);
        send({ type: "error", message, submissionId: submissionId || undefined });
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
  const isOcrSuspect = buildOcrSuspectChecker({
    source: submission.source,
    ocrText: submission.rawText,
    verifiedText: submission.verifiedText,
  });
  const errors = result.errors.map((e) => ({ ...e, ocrSuspect: isOcrSuspect(e) }));

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

  if (errors.length) {
    await prisma.errorRecord.createMany({
      data: errors.map((e) => ({
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
        ocrSuspect: e.ocrSuspect,
        confidence: e.confidence ?? 0.8,
      })),
    });
  }

  await prisma.submission.update({
    where: { id: submission.id },
    data: { status: "analyzed" },
  });

  await updateWeaknessProfiles({
    userId,
    submissionId: submission.id,
    submissionDate: submission.createdAt,
    errors: errors.map((e) => ({
      category: e.category,
      subcategory: e.subcategory,
      severity: e.severity,
      ocrSuspect: e.ocrSuspect,
    })),
  });
}

function formatError(err: unknown) {
  if (err instanceof z.ZodError) return "分析結果格式暫時不完整，請稍後再試。";
  if (err instanceof Error) return err.message;
  return "analysis failed";
}

export async function GET() {
  const { appUser: user } = await requireRole(["student", "admin"]);
  const subs = await prisma.submission.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { analyses: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return NextResponse.json({ submissions: subs });
}
