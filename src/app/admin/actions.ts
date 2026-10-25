"use server";

import { revalidatePath } from "next/cache";
import { clerkClient, type User } from "@clerk/nextjs/server";
import { type UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { INITIAL_CREDIT_REASON, INITIAL_FREE_CREDITS } from "@/lib/signupCredits";
import { requireRole } from "@/lib/auth";
import { addCreditsToUser, removeCreditsFromUser } from "@/lib/credits";
import { ADMIN_REASON_VALUES, buildCreditReason } from "@/lib/creditReasons";

const ROLES = new Set<UserRole>(["student", "teacher", "admin"]);

export async function syncClerkUsersAction() {
  await requireRole(["admin"]);

  const client = await clerkClient();
  const clerkUsers: User[] = [];
  const limit = 500;
  let offset = 0;
  let totalCount = 0;

  do {
    const page = await client.users.getUserList({
      limit,
      offset,
      orderBy: "+created_at",
    });

    if (page.data.length === 0) {
      break;
    }

    clerkUsers.push(...page.data);
    totalCount = page.totalCount;
    offset += page.data.length;
  } while (offset < totalCount);

  let created = 0;
  let linked = 0;

  for (const cu of clerkUsers) {
    const email =
      cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId)?.emailAddress ??
      cu.emailAddresses[0]?.emailAddress ??
      null;
    const name = [cu.firstName, cu.lastName].filter(Boolean).join(" ").trim() || cu.username || "同學";
    const metaRole = (cu.publicMetadata as Record<string, unknown>)?.role;
    const role: UserRole = metaRole === "teacher" || metaRole === "admin" ? (metaRole as UserRole) : "student";

    const existing = await prisma.appUser.findUnique({ where: { clerkUserId: cu.id } });
    if (existing) continue;

    // Try to link by email
    if (email) {
      const byEmail = await prisma.appUser.findUnique({ where: { email } });
      if (byEmail && !byEmail.clerkUserId) {
        await prisma.appUser.update({
          where: { id: byEmail.id },
          data: { clerkUserId: cu.id, name, role },
        });
        linked++;
        continue;
      }
    }

    // Create new
    await prisma.$transaction(async (tx) => {
      await tx.appUser.create({
        data: { clerkUserId: cu.id, email, name, role, credits: INITIAL_FREE_CREDITS, gradeLevel: "S2" },
      });
      await tx.creditTransaction.create({
        data: { clerkUserId: cu.id, amount: INITIAL_FREE_CREDITS, reason: INITIAL_CREDIT_REASON },
      });
    });
    created++;
  }

  revalidatePath("/admin/dashboard");
  return { created, linked };
}

// Admin form actions return a message for the page instead of throwing, so a
// failed change (e.g. removing more credits than a user has) shows inline.
export type AdminActionResult = { ok: boolean; message: string } | null;

const ROLE_LABELS: Record<UserRole, string> = { student: "學生", teacher: "老師", admin: "管理員" };
const MAX_CREDIT_CHANGE = 1000;

class AdminInputError extends Error {}

function errorMessage(err: unknown) {
  if (err instanceof AdminInputError) return err.message;
  if (err instanceof Error && /[\u4e00-\u9fff]/.test(err.message)) return err.message;
  console.error("Admin action failed", err);
  return "操作未能完成，請稍後再試。";
}

function revalidateAdminPages() {
  revalidatePath("/admin/dashboard");
  revalidatePath("/teacher/dashboard");
  revalidatePath("/student/dashboard");
}

// One save for everything in the user panel: role, unlimited credits and a credit change.
export async function saveUserAction(_prev: AdminActionResult, formData: FormData): Promise<AdminActionResult> {
  const { clerkUserId: adminClerkUserId } = await requireRole(["admin"]);
  const done: string[] = [];

  try {
    const targetClerkUserId = stringField(formData, "targetClerkUserId");
    const target = await prisma.appUser.findUnique({ where: { clerkUserId: targetClerkUserId } });
    if (!target) return { ok: false, message: "找不到這位用戶。" };

    const role = roleField(formData, "role");
    const unlimitedCredits = formData.get("unlimitedCredits") === "on";
    const amount = creditAmountField(formData, "creditAmount", { allowZero: true });
    const removing = formData.get("creditMode") === "remove";
    const reason = buildCreditReason(reasonField(formData), optionalText(formData, "creditNote"));

    if (role !== target.role && targetClerkUserId === adminClerkUserId) {
      return { ok: false, message: "不能更改自己的角色，請由另一位管理員操作。" };
    }

    if (role !== target.role) {
      await setUserRole(targetClerkUserId, role);
      done.push(`角色改為${ROLE_LABELS[role]}`);
    }
    if (unlimitedCredits !== target.unlimitedCredits) {
      await prisma.appUser.update({ where: { clerkUserId: targetClerkUserId }, data: { unlimitedCredits } });
      done.push(unlimitedCredits ? "開啟無限點數" : "關閉無限點數");
    }
    if (amount > 0) {
      if (removing) await removeCreditsFromUser(targetClerkUserId, amount, reason);
      else await addCreditsToUser(targetClerkUserId, amount, reason);
      done.push(`${removing ? "扣除" : "增加"} ${amount} 點`);
    }

    revalidateAdminPages();
    return done.length
      ? { ok: true, message: `已為 ${target.name}${done.join("、")}。` }
      : { ok: true, message: "沒有需要儲存的變更。" };
  } catch (err) {
    if (done.length) revalidateAdminPages();
    const message = errorMessage(err);
    return { ok: false, message: done.length ? `已${done.join("、")}，但${message}` : message };
  }
}

async function setUserRole(targetClerkUserId: string, role: UserRole) {
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(targetClerkUserId);
  await client.users.updateUserMetadata(targetClerkUserId, {
    publicMetadata: { ...clerkUser.publicMetadata, role },
  });
  await prisma.appUser.update({ where: { clerkUserId: targetClerkUserId }, data: { role } });
}

async function runClassAction(action: () => Promise<string>): Promise<AdminActionResult> {
  await requireRole(["admin"]);
  try {
    const message = await action();
    revalidateAdminPages();
    return { ok: true, message };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
}

async function teacherField(formData: FormData) {
  const teacherClerkUserId = stringField(formData, "teacherClerkUserId", "請選擇老師");
  const teacher = await prisma.appUser.findUnique({ where: { clerkUserId: teacherClerkUserId } });
  if (!teacher || teacher.role === "student") throw new AdminInputError("請選擇一位老師或管理員。");
  return teacher;
}

export async function createClassAction(_prev: AdminActionResult, formData: FormData): Promise<AdminActionResult> {
  return runClassAction(async () => {
    const name = stringField(formData, "name", "請填寫班級名稱");
    const teacher = await teacherField(formData);
    await prisma.class.create({ data: { name, teacherClerkUserId: teacher.clerkUserId! } });
    return `已建立班級「${name}」，老師：${teacher.name}。`;
  });
}

export async function updateClassAction(_prev: AdminActionResult, formData: FormData): Promise<AdminActionResult> {
  return runClassAction(async () => {
    const classId = stringField(formData, "classId");
    const name = stringField(formData, "name", "請填寫班級名稱");
    const teacher = await teacherField(formData);
    await prisma.class.update({ where: { id: classId }, data: { name, teacherClerkUserId: teacher.clerkUserId! } });
    return `已更新班級「${name}」。`;
  });
}

// Removes the class, its enrolments and its assignments; students' essays are kept.
export async function deleteClassAction(_prev: AdminActionResult, formData: FormData): Promise<AdminActionResult> {
  return runClassAction(async () => {
    const classId = stringField(formData, "classId");
    const deleted = await prisma.class.delete({ where: { id: classId } });
    return `已刪除班級「${deleted.name}」。`;
  });
}

export async function addStudentsToClassAction(_prev: AdminActionResult, formData: FormData): Promise<AdminActionResult> {
  return runClassAction(async () => {
    const classId = stringField(formData, "classId");
    const studentClerkUserIds = formData
      .getAll("studentClerkUserId")
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    if (studentClerkUserIds.length === 0) throw new AdminInputError("請先選擇學生。");
    const result = await prisma.studentClass.createMany({
      data: studentClerkUserIds.map((studentClerkUserId) => ({ classId, studentClerkUserId })),
      skipDuplicates: true,
    });
    return `已加入 ${result.count} 位學生。`;
  });
}

export async function removeStudentFromClassAction(_prev: AdminActionResult, formData: FormData): Promise<AdminActionResult> {
  return runClassAction(async () => {
    const classId = stringField(formData, "classId");
    const studentClerkUserId = stringField(formData, "studentClerkUserId");
    await prisma.studentClass.deleteMany({ where: { classId, studentClerkUserId } });
    return "已把學生移出班級。";
  });
}

// Gives every student in a class the same number of credits, in one transaction.
export async function grantClassCreditsAction(_prev: AdminActionResult, formData: FormData): Promise<AdminActionResult> {
  const { clerkUserId: adminClerkUserId } = await requireRole(["admin"]);
  try {
    const classId = stringField(formData, "classId");
    const amount = creditAmountField(formData, "creditAmount");
    const reason = buildCreditReason(reasonField(formData), optionalText(formData, "creditNote"));
    const klass = await prisma.class.findUnique({ where: { id: classId }, include: { studentClasses: true } });
    if (!klass) return { ok: false, message: "找不到這個班級。" };

    const enrolled = klass.studentClasses.map((membership) => membership.studentClerkUserId);
    const students = await prisma.appUser.findMany({ where: { clerkUserId: { in: enrolled } }, select: { clerkUserId: true } });
    const ids = students.map((student) => student.clerkUserId!);
    if (ids.length === 0) return { ok: false, message: "這個班級還沒有學生。" };

    await prisma.$transaction([
      prisma.appUser.updateMany({ where: { clerkUserId: { in: ids } }, data: { credits: { increment: amount } } }),
      prisma.creditTransaction.createMany({
        data: ids.map((clerkUserId) => ({ clerkUserId, amount, reason, createdByClerkUserId: adminClerkUserId })),
      }),
    ]);

    revalidateAdminPages();
    return { ok: true, message: `已為「${klass.name}」${ids.length} 位學生各增加 ${amount} 點。` };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
}

function stringField(formData: FormData, key: string, missingMessage = "資料不完整，請重新整理頁面再試。") {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    throw new AdminInputError(missingMessage);
  }
  return value.trim();
}

function optionalText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function creditAmountField(formData: FormData, key: string, options: { allowZero?: boolean } = {}) {
  const raw = formData.get(key);
  const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : 0;
  const min = options.allowZero ? 0 : 1;
  if (!Number.isInteger(value) || value < min || value > MAX_CREDIT_CHANGE) {
    throw new AdminInputError(`點數必須是 ${min}–${MAX_CREDIT_CHANGE} 之間的整數。`);
  }
  return value;
}

function reasonField(formData: FormData) {
  const value = formData.get("creditReason");
  return typeof value === "string" && ADMIN_REASON_VALUES.includes(value) ? value : "admin_adjustment";
}

function roleField(formData: FormData, key: string) {
  const value = stringField(formData, key);
  if (!ROLES.has(value as UserRole)) {
    throw new AdminInputError("角色無效。");
  }
  return value as UserRole;
}
