import "server-only";

import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export class InsufficientCreditsError extends Error {
  constructor(message = "沒有足夠批改點數。") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

export async function addCreditsToUser(targetClerkUserId: string, amount: number, reason: string) {
  const { clerkUserId: adminClerkUserId } = await requireRole(["admin"]);
  const normalizedAmount = positiveAmount(amount);
  const normalizedReason = nonEmptyReason(reason);

  return prisma.$transaction(async (tx) => {
    const appUser = await tx.appUser.update({
      where: { clerkUserId: targetClerkUserId },
      data: { credits: { increment: normalizedAmount } },
    });

    await tx.creditTransaction.create({
      data: {
        clerkUserId: targetClerkUserId,
        amount: normalizedAmount,
        reason: normalizedReason,
        createdByClerkUserId: adminClerkUserId,
      },
    });

    return appUser;
  });
}

export async function removeCreditsFromUser(targetClerkUserId: string, amount: number, reason: string) {
  const { clerkUserId: adminClerkUserId } = await requireRole(["admin"]);
  const normalizedAmount = positiveAmount(amount);
  const normalizedReason = nonEmptyReason(reason);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.appUser.updateMany({
      where: {
        clerkUserId: targetClerkUserId,
        credits: { gte: normalizedAmount },
      },
      data: { credits: { decrement: normalizedAmount } },
    });

    if (updated.count !== 1) {
      throw new InsufficientCreditsError("不能移除多於用戶目前持有的點數。");
    }

    await tx.creditTransaction.create({
      data: {
        clerkUserId: targetClerkUserId,
        amount: -normalizedAmount,
        reason: normalizedReason,
        createdByClerkUserId: adminClerkUserId,
      },
    });

    return tx.appUser.findUniqueOrThrow({ where: { clerkUserId: targetClerkUserId } });
  });
}

export async function deductCreditForSubmission() {
  const { clerkUserId } = await requireRole(["student"]);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.appUser.updateMany({
      where: {
        clerkUserId,
        credits: { gt: 0 },
      },
      data: { credits: { decrement: 1 } },
    });

    if (updated.count !== 1) {
      throw new InsufficientCreditsError();
    }

    await tx.creditTransaction.create({
      data: {
        clerkUserId,
        amount: -1,
        reason: "essay_submission",
        createdByClerkUserId: clerkUserId,
      },
    });

    return tx.appUser.findUniqueOrThrow({ where: { clerkUserId } });
  });
}

export async function refundCreditForSubmission(clerkUserId: string, reason: string) {
  const normalizedReason = nonEmptyReason(reason);

  return prisma.$transaction(async (tx) => {
    const appUser = await tx.appUser.update({
      where: { clerkUserId },
      data: { credits: { increment: 1 } },
    });

    await tx.creditTransaction.create({
      data: {
        clerkUserId,
        amount: 1,
        reason: normalizedReason,
      },
    });

    return appUser;
  });
}

function positiveAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit amount must be a positive integer.");
  }
  return amount;
}

function nonEmptyReason(reason: string) {
  const normalized = reason.trim();
  if (!normalized) {
    throw new Error("Credit transaction reason is required.");
  }
  return normalized;
}
