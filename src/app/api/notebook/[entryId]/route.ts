import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  NotebookUpdateSchema,
  normalizeFocusTag,
  normalizeNotebookTags,
  serializeNotebookEntry,
} from "@/lib/notebook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { entryId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const existing = await prisma.notebookEntry.findFirst({
    where: { id: params.entryId, userId: user.id },
    include: {
      submission: {
        select: {
          id: true,
          verifiedText: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = NotebookUpdateSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.notebookEntry.update({
    where: { id: existing.id },
    data: {
      title: parsed.data.title === undefined ? undefined : parsed.data.title.trim() || null,
      content: parsed.data.content === undefined ? undefined : parsed.data.content.trim(),
      focusTag: parsed.data.focusTag === undefined ? undefined : normalizeFocusTag(parsed.data.focusTag) || null,
      tags: parsed.data.tags === undefined ? undefined : normalizeNotebookTags(parsed.data.tags),
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

  return NextResponse.json({ entry: serializeNotebookEntry(updated) });
}

export async function DELETE(_req: Request, { params }: { params: { entryId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const existing = await prisma.notebookEntry.findFirst({
    where: { id: params.entryId, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.notebookEntry.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
