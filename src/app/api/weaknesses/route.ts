import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getOrCreateUser();
  const profiles = await prisma.weaknessProfile.findMany({
    where: { userId: user.id },
    orderBy: [{ status: "asc" }, { severityEwma: "desc" }],
  });
  return NextResponse.json({ profiles });
}
