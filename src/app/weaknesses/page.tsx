import { AbilityRadar } from "@/components/AbilityRadar";
import { CoachCard } from "@/components/CoachCard";
import { StatePanel } from "@/components/StatePanel";
import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { DEFAULT_WRITING_RUBRIC } from "@/lib/rubric";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  watching: "正在觀察",
  confirmed: "目前最值得先練",
  improving: "已經看見進步",
  resolved: "暫時穩住了",
};

export default async function WeaknessReportPage() {
  const user = await getOrCreateUser();
  const [profiles, recentSubmissions] = await Promise.all([
    prisma.weaknessProfile.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { severityEwma: "desc" }],
    }),
    prisma.submission.findMany({
      where: { userId: user.id, analyses: { some: {} } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { analyses: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);

  const analyses = recentSubmissions.map((submission) => submission.analyses[0]).filter(Boolean);
  const radarAxes = DEFAULT_WRITING_RUBRIC.criteria.map((criterion) => {
    const average =
      analyses.length === 0
        ? 0
        : analyses.reduce((sum, analysis) => sum + Number((analysis.scores as Record<string, number>)[criterion.key] ?? 0), 0) /
          analyses.length;
    return {
      label: criterion.label,
      value: average,
      max: criterion.maxScore,
      hint: hintForCriterion(criterion.key, average / criterion.maxScore),
    };
  });

  const highestAxis = [...radarAxes].sort((a, b) => b.value / b.max - a.value / a.max)[0];
  const lowestAxis = [...radarAxes].sort((a, b) => a.value / a.max - b.value / b.max)[0];

  const byStatus = new Map<string, typeof profiles>();
  for (const profile of profiles) {
    const list = byStatus.get(profile.status) || [];
    list.push(profile);
    byStatus.set(profile.status, list);
  }

  return (
    <div className="space-y-8">
      <section className="paper-panel-strong p-6 sm:p-7">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
          <div>
            <p className="section-kicker">能力地圖</p>
            <h1 className="mt-2 text-3xl sm:text-4xl">你的寫作能力，不只是一個分數</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/75">
              這張圖會把最近幾篇文章的表現綜合起來，幫你看見哪些面向比較穩、哪些面向值得先補強。它是成長地圖，不是排名。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <CoachCard title="目前較穩的地方" eyebrow="先看自己已經有的力量" tone="positive" className="h-full">
              <p className="font-medium text-ink">{highestAxis?.label || "內容"}</p>
              <p className="mt-2 text-sm text-muted">
                {highestAxis
                  ? `最近幾篇裡，${highestAxis.label} 相對更穩，記得把這份優勢延續到下一篇。`
                  : "交出幾篇文章後，這裡就會開始出現你的優勢區域。"}
              </p>
            </CoachCard>
            <CoachCard title="下一步的主練區" eyebrow="一次專注一項" tone="warm" className="h-full">
              <p className="font-medium text-ink">{lowestAxis?.label || "結構"}</p>
              <p className="mt-2 text-sm text-muted">
                {lowestAxis
                  ? `可以先從 ${lowestAxis.label} 下手，不用急著全補。先把一個面向練順，就會有很大差別。`
                  : "等有更多作品後，我會更準確地指出值得優先練習的方向。"}
              </p>
            </CoachCard>
          </div>
        </div>
      </section>

      {analyses.length === 0 ? (
        <StatePanel
          state="empty"
          title="能力地圖還在等待第一批作品"
          description="先交幾篇文章，我會根據最近幾次的表現畫出這張能力輪廓。到時你就能看到哪些面向正在變穩。"
          actionHref="/submissions/new"
          actionLabel="先交一篇文章"
        />
      ) : (
        <AbilityRadar axes={radarAxes} />
      )}

      {profiles.length === 0 ? (
        <StatePanel
          state="empty"
          title="還沒有足夠證據形成長期模式"
          description="這其實是好事，代表我們不會因為一兩次小失誤就急著給你貼標籤。先再交幾篇，我會只把真正穩定出現的模式整理出來。"
        />
      ) : (
        <div className="space-y-6">
          {["confirmed", "improving", "watching", "resolved"].map((status) => {
            const list = byStatus.get(status) || [];
            if (list.length === 0) return null;

            return (
              <section key={status} className="space-y-4">
                <div>
                  <p className="section-kicker">證據整理</p>
                  <h2 className="mt-2 text-2xl">{STATUS_LABEL[status] || status}</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {list.map((profile) => (
                    <CoachCard
                      key={profile.id}
                      title={`${profile.category}・${profile.subcategory}`}
                      eyebrow={statusCopy(status)}
                      tone={statusTone(status)}
                    >
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="pill">累積 {profile.evidenceCount} 次</span>
                          <span className="pill">嚴重度 {profile.severityEwma.toFixed(1)}</span>
                        </div>
                        <p className="text-sm text-muted">
                          首次出現：{formatDate(profile.firstSeenAt)}。最近一次：{formatDate(profile.lastSeenAt)}。
                        </p>
                      </div>
                    </CoachCard>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function hintForCriterion(key: string, ratio: number) {
  if (ratio >= 0.8) {
    return `${labelForKey(key)} 這一項已經相對穩定，記得把這種做法保留到下一篇。`;
  }
  if (ratio >= 0.6) {
    return `${labelForKey(key)} 正在建立中，再多幾次練習就會更穩。`;
  }
  return `${labelForKey(key)} 值得先多花一點心思，但不必一次補完。`;
}

function labelForKey(key: string) {
  const criterion = DEFAULT_WRITING_RUBRIC.criteria.find((item) => item.key === key);
  return criterion?.label || key;
}

function statusTone(status: string) {
  if (status === "improving" || status === "resolved") return "positive";
  if (status === "confirmed") return "warm";
  return "muted";
}

function statusCopy(status: string) {
  if (status === "confirmed") return "現在最值得優先整理";
  if (status === "improving") return "這裡已經看見下降趨勢";
  if (status === "resolved") return "先保持這份穩定";
  return "暫時先觀察，不急著下定論";
}

function formatDate(value: Date) {
  return value.toLocaleDateString("zh-HK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
