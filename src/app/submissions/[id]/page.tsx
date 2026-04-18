import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CoachCard } from "@/components/CoachCard";
import { AnnotatedText } from "@/components/AnnotatedText";
import { DEFAULT_WRITING_RUBRIC } from "@/lib/rubric";

export const dynamic = "force-dynamic";

export default async function SubmissionDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const submission = await prisma.submission.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      errors: { orderBy: { charOffsetStart: "asc" } },
    },
  });
  if (!submission) notFound();

  const analysis = submission.analyses[0];

  if (!analysis) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-lg border border-border bg-white p-6">
          {submission.status === "failed"
            ? "這篇文章的分析未能完成，請稍後再試一次。"
            : "導師仍在閱讀中，請稍候…"}
        </div>
      </div>
    );
  }

  const scores = analysis.scores as Record<string, number>;
  const strengths = analysis.strengths as string[];
  const priorities = analysis.revisionPriorities as string[];

  const errorsByCategory = new Map<string, typeof submission.errors>();
  for (const e of submission.errors) {
    const arr = errorsByCategory.get(e.category) || [];
    arr.push(e);
    errorsByCategory.set(e.category, arr);
  }

  return (
    <div className="space-y-8">
      <BackLink />

      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-2xl">導師回饋</h1>
        <div className="text-right">
          <div className="font-serif text-3xl">{analysis.overallScore.toFixed(0)}</div>
          <div className="text-xs text-muted">總分 / 100</div>
        </div>
      </div>

      <CoachCard title="導師的話">
        <p className="whitespace-pre-wrap leading-7">{analysis.coachFeedbackText}</p>
      </CoachCard>

      <div className="grid gap-4 md:grid-cols-2">
        <CoachCard title="這次做得好的地方">
          {strengths.length === 0 ? (
            <p className="text-muted">（沒有特別記錄亮點。）</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5">
              {strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </CoachCard>
        <CoachCard title="2–3 個修改重點">
          <ol className="list-decimal space-y-1 pl-5">
            {priorities.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        </CoachCard>
      </div>

      <CoachCard title="評分細項">
        <ul className="divide-y divide-border">
          {DEFAULT_WRITING_RUBRIC.criteria.map((c) => {
            const v = Number(scores[c.key] ?? 0);
            return (
              <li key={c.key} className="flex items-center justify-between py-2">
                <span>{c.label}</span>
                <span className="font-serif">
                  <span className="text-lg">{Math.round(v)}</span>
                  <span className="text-xs text-muted"> / {c.maxScore}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </CoachCard>

      <section className="space-y-3">
        <h2 className="font-serif text-lg">文章批改</h2>
        <AnnotatedText
          text={submission.verifiedText}
          errors={submission.errors.map((e) => ({
            id: e.id,
            category: e.category,
            subcategory: e.subcategory,
            charOffsetStart: e.charOffsetStart,
            charOffsetEnd: e.charOffsetEnd,
            severity: e.severity,
            suggestion: e.suggestion,
            ocrSuspect: e.ocrSuspect,
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-lg">錯誤分類</h2>
        {submission.errors.length === 0 ? (
          <p className="text-muted">沒有發現明顯錯誤。繼續保持！</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from(errorsByCategory.entries()).map(([cat, list]) => (
              <CoachCard key={cat} title={`${cat}（${list.length}）`}>
                <ul className="space-y-2">
                  {list.map((e) => (
                    <li key={e.id} className="text-sm">
                      <div className="text-xs text-muted">{e.subcategory}</div>
                      <div className="font-serif text-ink">「{e.evidenceSpan}」</div>
                      <div className="text-ink/80">{e.suggestion}</div>
                    </li>
                  ))}
                </ul>
              </CoachCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/" className="inline-block text-sm text-muted hover:text-accent">
      ← 回主頁
    </Link>
  );
}
