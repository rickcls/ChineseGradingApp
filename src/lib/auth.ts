import { cookies } from "next/headers";
import { prisma } from "./db";

const COOKIE = "ccoach_uid";

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
  const jar = cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) {
    // Middleware should prevent this, but fall back gracefully.
    throw new Error("Session cookie missing; middleware did not run.");
  }
  return findOrCreate(id, params);
}

export async function getCurrentUser() {
  const jar = cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}
