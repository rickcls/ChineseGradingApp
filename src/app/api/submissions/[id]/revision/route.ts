import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const Body = z.object({
  revisedText: z.string().min(20, "修訂稿至少需要 20 字").max(8000),
  targetedErrorIds: z.array(z.string()).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const submission = await prisma.submission.findFirst({
    where: { id: params.id, userId: user.id },
    include: { errors: true },
  });

  if (!submission) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const validTargetIds = new Set(
    (parsed.data.targetedErrorIds || []).filter((id) => submission.errors.some((error) => error.id === id)),
  );

  const relevantErrors = validTargetIds.size
    ? submission.errors.filter((error) => validTargetIds.has(error.id))
    : submission.errors;

  const changedEvidenceCount = relevantErrors.filter((error) =>
    !includesNormalized(parsed.data.revisedText, error.evidenceSpan),
  ).length;

  const improvementDelta = {
    beforeChars: Array.from(submission.verifiedText).length,
    afterChars: Array.from(parsed.data.revisedText).length,
    beforeParagraphs: countParagraphs(submission.verifiedText),
    afterParagraphs: countParagraphs(parsed.data.revisedText),
    totalEvidenceCount: relevantErrors.length,
    changedEvidenceCount,
  };

  const session = await prisma.revisionSession.create({
    data: {
      userId: user.id,
      originalSubmissionId: submission.id,
      revisedText: parsed.data.revisedText,
      targetedErrorIds: Array.from(validTargetIds),
      improvementDelta,
    },
  });

  return NextResponse.json(
    { id: session.id, compareUrl: `/submissions/${submission.id}/compare` },
    { status: 201 },
  );
}

function countParagraphs(text: string) {
  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean).length;
}

function includesNormalized(haystack: string, needle: string) {
  const normalizedHaystack = haystack.replace(/\s+/g, "");
  const normalizedNeedle = needle.replace(/\s+/g, "");
  return normalizedNeedle ? normalizedHaystack.includes(normalizedNeedle) : false;
}
