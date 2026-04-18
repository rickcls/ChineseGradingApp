import { PrismaClient } from "@prisma/client";
import { DEFAULT_WRITING_RUBRIC } from "../src/lib/rubric";

const prisma = new PrismaClient();

async function main() {
  await prisma.rubric.upsert({
    where: {
      gradeLevel_type_genre: {
        gradeLevel: DEFAULT_WRITING_RUBRIC.gradeLevel,
        type: DEFAULT_WRITING_RUBRIC.type,
        genre: DEFAULT_WRITING_RUBRIC.genre,
      },
    },
    create: {
      gradeLevel: DEFAULT_WRITING_RUBRIC.gradeLevel,
      type: DEFAULT_WRITING_RUBRIC.type,
      genre: DEFAULT_WRITING_RUBRIC.genre,
      rubricJson: DEFAULT_WRITING_RUBRIC as unknown as object,
    },
    update: { rubricJson: DEFAULT_WRITING_RUBRIC as unknown as object },
  });

  const tasks = [
    { gradeLevel: "S2", genre: "記敘文", promptText: "一次難忘的旅行", guidance: "寫一次真實或想像中的旅行，記得描寫感官細節與心情轉變。", suggestedLength: 500 },
    { gradeLevel: "S2", genre: "抒情文", promptText: "我最感激的一個人", guidance: "選一個對你影響很深的人，用具體事例表達感受。", suggestedLength: 500 },
    { gradeLevel: "S3", genre: "議論文", promptText: "網絡是否拉近了人與人之間的距離？", guidance: "立場清楚，每段一個論點，用例子支持。", suggestedLength: 600 },
  ];
  for (const t of tasks) {
    await prisma.writingTask.create({ data: t }).catch(() => null);
  }

  console.log("Seed complete.");
}

main().finally(() => prisma.$disconnect());
