"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { type UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { addCreditsToUser, removeCreditsFromUser } from "@/lib/credits";

const ROLES = new Set<UserRole>(["student", "teacher", "admin"]);

export async function updateUserRoleAction(formData: FormData) {
  await requireRole(["admin"]);

  const targetClerkUserId = stringField(formData, "targetClerkUserId");
  const role = roleField(formData, "role");

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(targetClerkUserId);

  await client.users.updateUserMetadata(targetClerkUserId, {
    publicMetadata: {
      ...clerkUser.publicMetadata,
      role,
    },
  });

  await prisma.appUser.update({
    where: { clerkUserId: targetClerkUserId },
    data: { role },
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/dashboard");
}

export async function adjustCreditsAction(formData: FormData) {
  const targetClerkUserId = stringField(formData, "targetClerkUserId");
  const amount = numberField(formData, "amount");
  const reason = stringField(formData, "reason");
  const mode = stringField(formData, "mode");

  if (mode === "remove") {
    await removeCreditsFromUser(targetClerkUserId, amount, reason);
  } else {
    await addCreditsToUser(targetClerkUserId, amount, reason);
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/student/dashboard");
}

export async function updateUnlimitedCreditsAction(formData: FormData) {
  await requireRole(["admin"]);

  const targetClerkUserId = stringField(formData, "targetClerkUserId");
  const unlimitedCredits = formData.get("unlimitedCredits") === "on";

  await prisma.appUser.update({
    where: { clerkUserId: targetClerkUserId },
    data: { unlimitedCredits },
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/student/dashboard");
}

export async function createClassAction(formData: FormData) {
  await requireRole(["admin"]);

  const name = stringField(formData, "name");
  const teacherClerkUserId = stringField(formData, "teacherClerkUserId");

  await prisma.class.create({
    data: {
      name,
      teacherClerkUserId,
    },
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/teacher/dashboard");
}

export async function assignStudentToClassAction(formData: FormData) {
  await requireRole(["admin"]);

  const classId = stringField(formData, "classId");
  const studentClerkUserId = stringField(formData, "studentClerkUserId");

  await prisma.studentClass.upsert({
    where: {
      studentClerkUserId_classId: {
        studentClerkUserId,
        classId,
      },
    },
    update: {},
    create: {
      studentClerkUserId,
      classId,
    },
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/teacher/dashboard");
}

function stringField(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

function numberField(formData: FormData, key: string) {
  const value = Number(stringField(formData, key));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return value;
}

function roleField(formData: FormData, key: string) {
  const value = stringField(formData, key);
  if (!ROLES.has(value as UserRole)) {
    throw new Error("Invalid role.");
  }
  return value as UserRole;
}
