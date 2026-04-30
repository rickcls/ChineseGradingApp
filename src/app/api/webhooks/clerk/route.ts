import { headers } from "next/headers";
import { Webhook } from "svix";
import { type UserJSON, type WebhookEvent } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

const INITIAL_FREE_CREDITS = 3;
const INITIAL_CREDIT_REASON = "initial_free_credits";

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("CLERK_WEBHOOK_SECRET not set", { status: 500 });
  }

  const headersList = await headers();
  const svixId = headersList.get("svix-id");
  const svixTimestamp = headersList.get("svix-timestamp");
  const svixSignature = headersList.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(secret);

  let event: WebhookEvent;
  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "user.created") {
    await syncUserToDb(event.data);
  } else if (event.type === "user.updated") {
    await syncUserToDb(event.data);
  }

  return new Response("OK", { status: 200 });
}

async function syncUserToDb(data: UserJSON) {
  const clerkUserId = data.id;
  const email = data.email_addresses.find((e) => e.id === data.primary_email_address_id)?.email_address
    ?? data.email_addresses[0]?.email_address
    ?? null;
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || data.username || "同學";
  const role = (data.public_metadata as Record<string, unknown>)?.role;
  const validRole = role === "teacher" || role === "admin" ? role : "student";

  const existing = await prisma.appUser.findUnique({ where: { clerkUserId } });

  if (existing) {
    await prisma.appUser.update({
      where: { clerkUserId },
      data: { email, name, role: validRole },
    });
    return;
  }

  // Check if there's an existing record by email to link
  if (email) {
    const byEmail = await prisma.appUser.findUnique({ where: { email } });
    if (byEmail && !byEmail.clerkUserId) {
      await prisma.appUser.update({
        where: { id: byEmail.id },
        data: { clerkUserId, name, role: validRole },
      });
      return;
    }
  }

  // Create new record with initial credits
  await prisma.$transaction(async (tx) => {
    await tx.appUser.create({
      data: {
        clerkUserId,
        email,
        name,
        role: validRole,
        credits: INITIAL_FREE_CREDITS,
        gradeLevel: "S2",
      },
    });

    await tx.creditTransaction.create({
      data: {
        clerkUserId,
        amount: INITIAL_FREE_CREDITS,
        reason: INITIAL_CREDIT_REASON,
      },
    });
  });
}
