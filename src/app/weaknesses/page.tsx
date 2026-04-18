import { prisma } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth";
import { CoachCard } from "@/components/CoachCard";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  watching: "觀察中",
  confirmed: "已確認重點",
  improving: "正在進步",
  resolved: "已解決",
};

export default async function WeaknessReportPage() {
  const user = await getOrCreateUser();
  const profiles = await prisma.weaknessProfile.findMany({
    where: { userId: user.id },
    orderBy: [{ status: "asc" }, { severityEwma: "desc" }],
  });

  const byStatus = new Map<string, typeof profiles>();
  for (const p of profiles) {
    const arr = byStatus.get(p.status) || [];
    arr.push(p);
    byStatus.set(p.status, arr);
  }

  const order = ["confirmed", "watching", "improving", "resolved"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">重點回顧</h1>
        <p className="mt-1 text-sm text-muted">
          這裡只會展示有證據支撐的模式——不會把一時的小失誤當作長期弱點。慢慢來，一次專注一兩項。
        </p>
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted">
          還沒有資料。先交幾篇文章，讓我看一看。
        </div>
      ) : (
        <div className="space-y-6">
          {order.map((status) => {
            const list = byStatus.get(status) || [];
            if (list.length === 0) return null;
            return (
              <section key={status} className="space-y-3">
                <h2 className="font-serif text-lg">{STATUS_LABEL[status] || status}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {list.map((w) => (
                    <CoachCard key={w.id}>
                      <div className="flex items-baseline justify-between">
                        <div>
                          <div className="font-serif text-base">
                            {w.category}・{w.subcategory}
                          </div>
                          <div className="text-xs text-muted">
                            首次出現：{new Date(w.firstSeenAt).toLocaleDateString("zh-HK")}・
                            最近一次：{new Date(w.lastSeenAt).toLocaleDateString("zh-HK")}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div>{w.evidenceCount} 次</div>
                          <div className="text-xs text-muted">嚴重度 {w.severityEwma.toFixed(2)}</div>
                        </div>
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
