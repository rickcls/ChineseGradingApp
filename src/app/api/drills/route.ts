import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { toDrillView } from "@/lib/drillView";
import { DRILL_DAILY_LIMIT, DRILL_MAX_CHECKS, generateDrillTask } from "@/lib/practiceDrill";
import { TAXONOMY, validCategory } from "@/lib/taxonomy";
import { countsTowardWeakness } from "@/lib/weakness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  category: z.string().min(1),
  subcategory: z.string().min(1),
  // Skip the unfinished drill for this weakness and make a new one.
  fresh: z.boolean().optional(),
});

export async function POST(req: Request) {
  const { appUser: user } = await requireRole(["student", "admin"]);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !validCategory(parsed.data.category, parsed.data.subcategory)) {
    return NextResponse.json({ error: "未知的弱項類別。" }, { status: 400 });
  }
  const { category, subcategory, fresh } = parsed.data;

  if (!fresh) {
    const unfinished = await prisma.practiceDrill.findFirst({
      where: { userId: user.id, category, subcategory, completedAt: null, attempts: { lt: DRILL_MAX_CHECKS } },
      orderBy: { createdAt: "desc" },
    });
    const view = unfinished ? toDrillView(unfinished) : null;
    if (view) return NextResponse.json({ drill: view });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const usedToday = await prisma.practiceDrill.count({ where: { userId: user.id, createdAt: { gte: since } } });
  if (usedToday >= DRILL_DAILY_LIMIT) {
    return NextResponse.json({ error: `今天已開了 ${usedToday} 個練習，明天再來吧。` }, { status: 429 });
  }

  const recentErrors = await prisma.errorRecord.findMany({
    where: { category, subcategory, submission: { userId: user.id } },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { evidenceSpan: true, suggestion: true, ocrSuspect: true, studentReaction: true },
  });
  const examples = recentErrors
    .filter(countsTowardWeakness)
    .slice(0, 3)
    .map((error) => ({ evidenceSpan: error.evidenceSpan, suggestion: error.suggestion }));
  const description =
    TAXONOMY.find((entry) => entry.category === category)?.subcategories.find((s) => s.key === subcategory)
      ?.description ?? "";

  try {
    const task = await generateDrillTask({ category, subcategory, description, gradeLevel: user.gradeLevel, examples });
    const drill = await prisma.practiceDrill.create({
      data: { userId: user.id, category, subcategory, task },
    });
    return NextResponse.json({ drill: toDrillView(drill) }, { status: 201 });
  } catch (error) {
    console.error("Practice drill generation failed", error);
    return NextResponse.json({ error: "暫時未能出題，請稍後再試。" }, { status: 500 });
  }
}
