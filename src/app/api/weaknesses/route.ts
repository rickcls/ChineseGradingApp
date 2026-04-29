import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const { appUser: user } = await requireRole(["student"]);
  const profiles = await prisma.weaknessProfile.findMany({
    where: { userId: user.id },
    orderBy: [{ status: "asc" }, { severityEwma: "desc" }],
  });
  return NextResponse.json({ profiles });
}
