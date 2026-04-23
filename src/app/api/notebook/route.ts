import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  NotebookCreateSchema,
  normalizeFocusTag,
  normalizeNotebookTags,
  serializeNotebookEntry,
} from "@/lib/notebook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(req.url);
  const submissionId = url.searchParams.get("submissionId")?.trim() || undefined;
  const tag = url.searchParams.get("tag")?.trim() || undefined;
  const query = url.searchParams.get("q")?.trim() || undefined;

  const filters: Prisma.NotebookEntryWhereInput[] = [];

  if (submissionId) {
    filters.push({ submissionId });
  }

  if (tag) {
    filters.push({
      OR: [{ focusTag: tag }, { tags: { has: tag } }],
    });
  }

  if (query) {
    filters.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
        { sourceBeforeText: { contains: query, mode: "insensitive" } },
        { sourceAfterText: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  const entries = await prisma.notebookEntry.findMany({
    where: {
      userId: user.id,
      ...(filters.length > 0 ? { AND: filters } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      submission: {
        select: {
          id: true,
          verifiedText: true,
        },
      },
    },
    take: 200,
  });

  return NextResponse.json({ entries: entries.map(serializeNotebookEntry) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = NotebookCreateSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.submissionId) {
    const ownedSubmission = await prisma.submission.findFirst({
      where: { id: parsed.data.submissionId, userId: user.id },
      select: { id: true },
    });

    if (!ownedSubmission) {
      return NextResponse.json({ error: "submission not found" }, { status: 404 });
    }
  }

  if (parsed.data.sourcePassageId) {
    const ownedPassage = await prisma.aiModelPassage.findFirst({
      where: { id: parsed.data.sourcePassageId, userId: user.id },
      select: { id: true },
    });

    if (!ownedPassage) {
      return NextResponse.json({ error: "source passage not found" }, { status: 404 });
    }
  }

  const entry = await prisma.notebookEntry.create({
    data: {
      userId: user.id,
      submissionId: parsed.data.submissionId,
      sourcePassageId: parsed.data.sourcePassageId,
      entryType: parsed.data.entryType,
      title: parsed.data.title?.trim() || null,
      content: parsed.data.content.trim(),
      focusTag: normalizeFocusTag(parsed.data.focusTag) || null,
      tags: normalizeNotebookTags(parsed.data.tags),
      sourceBeforeText: parsed.data.sourceBeforeText?.trim() || null,
      sourceAfterText: parsed.data.sourceAfterText?.trim() || null,
    },
    include: {
      submission: {
        select: {
          id: true,
          verifiedText: true,
        },
      },
    },
  });

  return NextResponse.json({ entry: serializeNotebookEntry(entry) }, { status: 201 });
}
