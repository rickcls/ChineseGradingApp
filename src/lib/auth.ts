import { cookies } from "next/headers";
import { headers } from "next/headers";
import { prisma } from "./db";

const COOKIE = "ccoach_uid";
const FORWARDED_USER_HEADER = "x-ccoach-uid";

async function findOrCreate(id: string, params?: { displayName?: string; gradeLevel?: string }) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      id,
      displayName: params?.displayName || "同學",
      gradeLevel: params?.gradeLevel || "S2",
    },
  });
}

// Safe in pages, route handlers, and server actions. The middleware guarantees
// the cookie exists on every request, so no cookies().set() call is needed here.
export async function getOrCreateUser(params?: { displayName?: string; gradeLevel?: string }) {
  const jar = await cookies();
  const headerList = await headers();
  const id = jar.get(COOKIE)?.value ?? headerList.get(FORWARDED_USER_HEADER);
  if (!id) {
    // Middleware should prevent this, but fall back gracefully.
    throw new Error("Session cookie missing; middleware did not run.");
  }
  return findOrCreate(id, params);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const headerList = await headers();
  const id = jar.get(COOKIE)?.value ?? headerList.get(FORWARDED_USER_HEADER);
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}
