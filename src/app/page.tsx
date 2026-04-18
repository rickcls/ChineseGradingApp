import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { CoachCard } from "@/components/CoachCard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getOrCreateUser();
  const [submissions, confirmed, improving] = await Promise.all([
    prisma.submission.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { analyses: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    prisma.weaknessProfile.findMany({
      where: { userId: user.id, status: "confirmed" },
      orderBy: { severityEwma: "desc" },
      take: 3,
    }),
    prisma.weaknessProfile.findMany({
      where: { userId: user.id, status: "improving" },
      orderBy: { lastSeenAt: "desc" },
      take: 3,
    }),
  ]);

  const greeting = greetingFor(user.displayName, submissions.length);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <p className="font-serif text-xl leading-relaxed">{greeting}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <CoachCard title="本週的練習重點">
          {confirmed.length === 0 ? (
            <p className="text-muted">
              還沒有足夠資料找出重點。先多寫幾篇文章，我會慢慢看出你的寫作習慣。
            </p>
          ) : (
            <ul className="space-y-2">
              {confirmed.map((w) => (
                <li key={w.id} className="flex items-start gap-2">
                  <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-accent" />
                  <span>
                    <strong>{w.category}・{w.subcategory}</strong>
                    <span className="ml-2 text-xs text-muted">出現 {w.evidenceCount} 次</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CoachCard>

        <CoachCard title="正在進步中">
          {improving.length === 0 ? (
            <p className="text-muted">每一次交稿都是進步的機會。</p>
          ) : (
            <ul className="space-y-2">
              {improving.map((w) => (
                <li key={w.id} className="flex items-start gap-2">
                  <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-good" />
                  <span>
                    <strong>{w.category}・{w.subcategory}</strong>
                    <span className="ml-2 text-xs text-good">持續改善中</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CoachCard>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">最近提交</h2>
          <Link href="/submissions/new" className="text-sm text-accent hover:underline">
            提交新文章 →
          </Link>
        </div>
        {submissions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted">
            還沒有提交過文章。
            <Link href="/submissions/new" className="ml-2 text-accent hover:underline">
              現在就開始寫一篇？
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-white">
            {submissions.map((s) => {
              const a = s.analyses[0];
              const preview = s.verifiedText.slice(0, 40);
              return (
                <li key={s.id}>
                  <Link href={`/submissions/${s.id}`} className="block px-5 py-4 hover:bg-paper">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1 truncate font-serif">{preview}…</div>
                      <div className="ml-4 text-right text-sm text-muted">
                        {a ? <span>分數 {a.overallScore.toFixed(0)}</span> : <span>處理中</span>}
                        <div className="text-xs">{new Date(s.createdAt).toLocaleDateString("zh-HK")}</div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function greetingFor(name: string, count: number): string {
  if (count === 0) return `歡迎，${name}。把你的第一篇文章交給我，我會像老師一樣細心閱讀並給你具體的回饋。`;
  if (count < 3) return `${name}，很高興再見到你。每一次書寫都是一次小小的練習，慢慢累積就會看到進步。`;
  return `${name}，你已經寫了 ${count} 篇文章了——這份堅持本身就值得肯定。`;
}
