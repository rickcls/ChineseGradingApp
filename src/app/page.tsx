import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { CoachCard } from "@/components/CoachCard";
import { StatePanel } from "@/components/StatePanel";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getOrCreateUser();
  const [submissions, confirmed, improving] = await Promise.all([
    prisma.submission.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        analyses: { orderBy: { createdAt: "desc" }, take: 1 },
        revisionOrigin: { orderBy: { createdAt: "desc" }, take: 1 },
      },
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

  const analyses = submissions.map((submission) => submission.analyses[0]).filter(Boolean);
  const averageScore = analyses.length
    ? analyses.reduce((sum, analysis) => sum + analysis.overallScore, 0) / analyses.length
    : null;
  const activeDays = new Set(submissions.map((submission) => submission.createdAt.toISOString().slice(0, 10))).size;
  const revisionsStarted = submissions.filter((submission) => submission.revisionOrigin.length > 0).length;

  return (
    <div className="space-y-8">
      <section className="paper-panel-strong overflow-hidden p-6 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
          <div className="space-y-4">
            <p className="section-kicker">學生主頁</p>
            <div>
              <h1 className="text-3xl sm:text-4xl">{greetingFor(user.displayName, submissions.length)}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/75">
                這裡記錄的不是你哪裡做得不夠，而是你已經寫了多少、正在改善什麼、下一步可以先從哪裡開始。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/submissions/new" className="btn-primary">
                提交新文章
              </Link>
              <Link href="/weaknesses" className="btn-secondary">
                查看能力地圖
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <MetricCard label="已寫文章" value={`${submissions.length}`} hint="每一篇都在累積你的寫作肌肉" />
            <MetricCard
              label="最近平均"
              value={averageScore ? averageScore.toFixed(0) : "—"}
              hint={averageScore ? "先看趨勢，不用盯住單次分數" : "交出第一篇後就會出現"}
              tone="primary"
            />
            <MetricCard label="曾啟動修訂" value={`${revisionsStarted}`} hint="願意回頭修改，本身就是進步" tone="positive" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <CoachCard title="本週導師建議" eyebrow="先挑 1–2 項就好" tone="primary">
          {confirmed.length === 0 ? (
            <p className="text-muted">
              還沒有足夠資料找出穩定模式。這不是壞事，代表我們還在觀察。先多寫兩三篇，我再幫你找出真正值得優先練的地方。
            </p>
          ) : (
            <ul className="space-y-3">
              {confirmed.map((item) => (
                <li key={item.id} className="rounded-2xl border border-white/70 bg-white/75 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-ink">
                      {item.category}・{item.subcategory}
                    </strong>
                    <span className="pill pill-warm">累積 {item.evidenceCount} 次</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    先把這個小地方修順，整篇文章的清晰度通常就會明顯提升。
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CoachCard>

        <div className="grid gap-4">
          <CoachCard title="正在穩穩進步" eyebrow="看見努力" tone="positive">
            {improving.length === 0 ? (
              <p className="text-muted">每一次交稿都是訊號。還沒有明顯下降的項目也沒關係，我會繼續幫你追蹤變化。</p>
            ) : (
              <ul className="space-y-3">
                {improving.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-good/20 bg-white/75 px-4 py-3">
                    <div>
                      <div className="font-medium text-ink">
                        {item.category}・{item.subcategory}
                      </div>
                      <div className="text-xs text-muted">最近一次出現：{formatDate(item.lastSeenAt)}</div>
                    </div>
                    <span className="pill pill-positive">持續改善中</span>
                  </li>
                ))}
              </ul>
            )}
          </CoachCard>

          <CoachCard title="你的寫作節奏" eyebrow="不是比快，是比穩" tone="muted">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-white/75 px-4 py-4">
                <div className="text-2xl text-ink">{activeDays}</div>
                <div className="mt-1 text-xs text-muted">有練習的日子</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-white/75 px-4 py-4">
                <div className="text-2xl text-ink">{submissions.filter((submission) => submission.source !== "typed").length}</div>
                <div className="mt-1 text-xs text-muted">次照片／掃描交稿</div>
              </div>
            </div>
          </CoachCard>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">最近作品</p>
            <h2 className="mt-2 text-2xl">從最近幾篇裡看看自己的節奏</h2>
          </div>
          <Link href="/submissions/new" className="btn-secondary">
            再交一篇
          </Link>
        </div>

        {submissions.length === 0 ? (
          <StatePanel
            state="empty"
            title="還沒有第一篇文章"
            description="先交出一篇，導師就能開始幫你標出亮點、整理優先修改方向，也會慢慢建立你的能力地圖。"
            actionHref="/submissions/new"
            actionLabel="開始第一篇"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {submissions.map((submission) => {
              const analysis = submission.analyses[0];
              const preview = submission.verifiedText.slice(0, 52);
              const hasRevision = submission.revisionOrigin.length > 0;

              return (
                <Link
                  key={submission.id}
                  href={`/submissions/${submission.id}`}
                  className="paper-panel block p-5 transition hover:-translate-y-0.5 hover:border-accent/25 hover:shadow-float"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <span className={submission.source === "typed" ? "pill" : "pill pill-warm"}>
                        {sourceLabel(submission.source)}
                      </span>
                      <div className="font-serif text-lg leading-8 text-ink">{preview}…</div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-2xl text-ink">{analysis ? analysis.overallScore.toFixed(0) : "…"}</div>
                      <div className="text-xs text-muted">{analysis ? "整體分數" : "分析中"}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{formatDate(submission.createdAt)}</span>
                    {hasRevision ? <span className="pill pill-positive">已有修訂對照</span> : null}
                    {!analysis && submission.status === "failed" ? <span className="pill pill-warm">需要重新提交</span> : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "primary" | "positive";
}) {
  const toneClass =
    tone === "primary"
      ? "border-accent/20 bg-accent/5"
      : tone === "positive"
        ? "border-good/20 bg-good/10"
        : "border-border/70 bg-white/80";

  return (
    <div className={["rounded-[1.15rem] border px-4 py-4 shadow-soft", toneClass].join(" ")}>
      <p className="section-kicker">{label}</p>
      <div className="mt-2 text-3xl text-ink">{value}</div>
      <p className="mt-1 text-xs leading-6 text-muted">{hint}</p>
    </div>
  );
}

function greetingFor(name: string, count: number): string {
  if (count === 0) return `你好，${name}。先交出第一篇，我會陪你把寫作這件事慢慢變得不那麼可怕。`;
  if (count < 3) return `${name}，很高興又見到你。每一次願意交稿，都是在替自己累積更穩的表達力。`;
  return `${name}，你已經寫了 ${count} 篇文章。這份持續練習，本身就很值得被看見。`;
}

function sourceLabel(source: string) {
  if (source === "photo") return "拍照交稿";
  if (source === "scan") return "掃描稿";
  return "直接輸入";
}

function formatDate(value: Date) {
  return value.toLocaleDateString("zh-HK", {
    month: "short",
    day: "numeric",
  });
}
