import "server-only";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { type AppUser, type UserRole } from "@prisma/client";
import { prisma } from "./db";

const COOKIE = "ccoach_uid";
const FORWARDED_USER_HEADER = "x-ccoach-uid";
const INITIAL_FREE_CREDITS = 3;
const INITIAL_CREDIT_REASON = "initial_free_credits";

const ROLES = new Set<UserRole>(["student", "teacher", "admin"]);

type UserParams = {
  displayName?: string;
  name?: string;
  gradeLevel?: string;
};

type ClerkLikeUser = Awaited<ReturnType<typeof currentUser>>;

export type AuthenticatedAppUser = AppUser & {
  clerkUserId: string;
};

export async function getCurrentUserRole(): Promise<UserRole> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return "student";
  if (isBootstrapAdmin(userId)) return "admin";

  const clerkUser = await currentUser();
  const metadataRole = roleFromUnknown(clerkUser?.publicMetadata);
  if (metadataRole) return metadataRole;

  const claimRole = roleFromUnknown(sessionClaims);
  if (claimRole) return claimRole;

  const appUser = await prisma.appUser.findUnique({
    where: { clerkUserId: userId },
    select: { role: true },
  });

  return appUser?.role ?? "student";
}

export async function requireRole(allowedRoles: UserRole[]) {
  const appUser = await getOrCreateAppUser();
  const role = await getCurrentUserRole();

  if (!allowedRoles.includes(role)) {
    redirect("/unauthorized");
  }

  return { appUser, role, clerkUserId: appUser.clerkUserId };
}

export async function getOrCreateAppUser(params?: UserParams): Promise<AuthenticatedAppUser> {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");

  const [clerkUser, jar] = await Promise.all([currentUser(), cookies()]);
  const cookieUserId = jar.get(COOKIE)?.value;
  const email = primaryEmailFor(clerkUser);
  const name = nameFor(clerkUser, params);
  const requestedGradeLevel = params?.gradeLevel?.trim() || undefined;
  const role = isBootstrapAdmin(userId)
    ? "admin"
    : roleFromUnknown(clerkUser?.publicMetadata) || roleFromUnknown(sessionClaims) || "student";

  let appUser = await prisma.appUser.findUnique({ where: { clerkUserId: userId } });

  if (!appUser && email) {
    const emailUser = await prisma.appUser.findUnique({ where: { email } });
    if (emailUser) {
      if (emailUser.clerkUserId && emailUser.clerkUserId !== userId) {
        throw new Error(
          "This email is already linked to a different Clerk user. Check AppUser.clerkUserId before continuing.",
        );
      }

      appUser = await prisma.appUser.update({
        where: { id: emailUser.id },
        data: {
          clerkUserId: userId,
          name,
          role,
          gradeLevel: requestedGradeLevel || emailUser.gradeLevel,
        },
      });
    }
  }

  if (!appUser && cookieUserId) {
    const legacyUser = await prisma.appUser.findUnique({ where: { id: cookieUserId } });
    if (legacyUser && !legacyUser.clerkUserId) {
      appUser = await prisma.$transaction(async (tx) => {
        const updated = await tx.appUser.update({
          where: { id: legacyUser.id },
          data: {
            clerkUserId: userId,
            email,
            name,
            role,
            gradeLevel: requestedGradeLevel || legacyUser.gradeLevel,
            credits: { increment: INITIAL_FREE_CREDITS },
          },
        });

        await tx.creditTransaction.create({
          data: {
            clerkUserId: userId,
            amount: INITIAL_FREE_CREDITS,
            reason: INITIAL_CREDIT_REASON,
          },
        });

        return updated;
      });
    }
  }

  if (!appUser) {
    appUser = await prisma.$transaction(async (tx) => {
      const created = await tx.appUser.create({
        data: {
          clerkUserId: userId,
          email,
          name,
          role,
          credits: INITIAL_FREE_CREDITS,
          gradeLevel: requestedGradeLevel || "S2",
        },
      });

      await tx.creditTransaction.create({
        data: {
          clerkUserId: userId,
          amount: INITIAL_FREE_CREDITS,
          reason: INITIAL_CREDIT_REASON,
        },
      });

      return created;
    });
  } else {
    appUser = await syncAppUserProfile(appUser, {
      email,
      name,
      role,
      gradeLevel: requestedGradeLevel,
    });
    appUser = await ensureInitialCredits(appUser);
  }

  await syncClerkRole(userId, clerkUser, role);

  return appUser as AuthenticatedAppUser;
}

export async function getOrCreateUser(params?: UserParams) {
  return getOrCreateAppUser(params);
}

export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;
  return getOrCreateAppUser();
}

function roleFromUnknown(value: unknown): UserRole | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const direct = normalizeRole(record.role);
  if (direct) return direct;

  const publicMetadata = record.publicMetadata;
  if (publicMetadata && typeof publicMetadata === "object") {
    const role = normalizeRole((publicMetadata as Record<string, unknown>).role);
    if (role) return role;
  }

  const metadata = record.metadata;
  if (metadata && typeof metadata === "object") {
    const role = normalizeRole((metadata as Record<string, unknown>).role);
    if (role) return role;
  }

  return null;
}

function normalizeRole(value: unknown): UserRole | null {
  return typeof value === "string" && ROLES.has(value as UserRole) ? (value as UserRole) : null;
}

function primaryEmailFor(user: ClerkLikeUser) {
  return user?.primaryEmailAddress?.emailAddress || user?.emailAddresses[0]?.emailAddress || null;
}

function nameFor(user: ClerkLikeUser, params?: UserParams) {
  const explicitName = params?.name?.trim() || params?.displayName?.trim();
  if (explicitName) return explicitName;
  if (user?.fullName) return user.fullName;

  const joined = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  if (joined) return joined;

  if (user?.username) return user.username;

  return "同學";
}

function bootstrapAdminIds() {
  return new Set(
    (process.env.ADMIN_CLERK_USER_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

function isBootstrapAdmin(userId: string) {
  return bootstrapAdminIds().has(userId);
}

async function syncAppUserProfile(
  appUser: AppUser,
  next: { email: string | null; name: string; role: UserRole; gradeLevel?: string },
) {
  const data: Partial<Pick<AppUser, "email" | "name" | "role" | "gradeLevel">> = {};

  if (next.email !== appUser.email) data.email = next.email;
  if (next.name && next.name !== appUser.name) data.name = next.name;
  if (next.role !== appUser.role) data.role = next.role;
  if (next.gradeLevel && next.gradeLevel !== appUser.gradeLevel) data.gradeLevel = next.gradeLevel;

  if (Object.keys(data).length === 0) return appUser;

  return prisma.appUser.update({
    where: { id: appUser.id },
    data,
  });
}

async function ensureInitialCredits(appUser: AppUser) {
  if (!appUser.clerkUserId) return appUser;

  const existingGrant = await prisma.creditTransaction.findFirst({
    where: {
      clerkUserId: appUser.clerkUserId,
      reason: INITIAL_CREDIT_REASON,
    },
    select: { id: true },
  });

  if (existingGrant) return appUser;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.appUser.update({
      where: { id: appUser.id },
      data: { credits: { increment: INITIAL_FREE_CREDITS } },
    });

    await tx.creditTransaction.create({
      data: {
        clerkUserId: appUser.clerkUserId!,
        amount: INITIAL_FREE_CREDITS,
        reason: INITIAL_CREDIT_REASON,
      },
    });

    return updated;
  });
}

async function syncClerkRole(userId: string, user: ClerkLikeUser, role: UserRole) {
  if (roleFromUnknown(user?.publicMetadata) === role) return;

  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...(user?.publicMetadata || {}),
      role,
    },
  });
}
