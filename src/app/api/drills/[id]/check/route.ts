import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { toDrillView } from "@/lib/drillView";
import {
  DRILL_MAX_CHARS,
  DRILL_MAX_CHECKS,
  DRILL_MIN_CHARS,
  checkDrillResponse,
  readDrillTask,
} from "@/lib/practiceDrill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ response: z.string().trim() });

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { appUser: user } = await requireRole(["student", "admin"]);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  const response = parsed.success ? parsed.data.response : "";
  const length = Array.from(response).length;
  if (length < DRILL_MIN_CHARS || length > DRILL_MAX_CHARS) {
    return NextResponse.json(
      { error: `請寫 ${DRILL_MIN_CHARS}–${DRILL_MAX_CHARS} 字（目前 ${length} 字）。` },
      { status: 400 },
    );
  }

  const drill = await prisma.practiceDrill.findFirst({ where: { id: params.id, userId: user.id } });
  if (!drill) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (drill.completedAt) {
    return NextResponse.json({ error: "這個練習已經完成，可以再來一題。" }, { status: 409 });
  }
  if (drill.attempts >= DRILL_MAX_CHECKS) {
    return NextResponse.json({ error: `每個練習最多檢查 ${DRILL_MAX_CHECKS} 次，可以再來一題。` }, { status: 429 });
  }
  const task = readDrillTask(drill.task);
  if (!task) return NextResponse.json({ error: "練習資料有誤，請再來一題。" }, { status: 500 });

  try {
    const feedback = await checkDrillResponse({ task, response });
    const updated = await prisma.practiceDrill.update({
      where: { id: drill.id },
      data: {
        response,
        feedback,
        attempts: { increment: 1 },
        completedAt: feedback.allMet ? new Date() : null,
      },
    });
    return NextResponse.json({ drill: toDrillView(updated) });
  } catch (error) {
    console.error("Practice drill check failed", error);
    return NextResponse.json({ error: "暫時未能檢查，請稍後再試（這次不計次數）。" }, { status: 500 });
  }
}
