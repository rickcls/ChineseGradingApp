import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const emptyLegacyUserWhere = {
  clerkUserId: null,
  submissions: { none: {} },
  weaknessProfiles: { none: {} },
  revisionSessions: { none: {} },
  feedbackEvents: { none: {} },
  aiModelPassages: { none: {} },
  notebookEntries: { none: {} },
} as const;

async function main() {
  const execute = process.argv.includes("--execute");

  const [legacyTotal, emptyLegacyTotal, legacyWithDataTotal] = await Promise.all([
    prisma.appUser.count({ where: { clerkUserId: null } }),
    prisma.appUser.count({ where: emptyLegacyUserWhere }),
    prisma.appUser.count({
      where: {
        clerkUserId: null,
        OR: [
          { submissions: { some: {} } },
          { weaknessProfiles: { some: {} } },
          { revisionSessions: { some: {} } },
          { feedbackEvents: { some: {} } },
          { aiModelPassages: { some: {} } },
          { notebookEntries: { some: {} } },
        ],
      },
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        mode: execute ? "execute" : "dry-run",
        legacyTotal,
        emptyLegacyTotal,
        legacyWithDataTotal,
      },
      null,
      2,
    ),
  );

  if (!execute) {
    console.log("Dry run only. Re-run with --execute to delete empty legacy users.");
    return;
  }

  const result = await prisma.appUser.deleteMany({ where: emptyLegacyUserWhere });
  console.log(`Deleted ${result.count} empty legacy users.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
