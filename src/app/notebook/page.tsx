import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { previewSubmission, serializeNotebookEntry } from "@/lib/notebook";
import { NotebookWorkspace } from "@/components/NotebookWorkspace";

export const dynamic = "force-dynamic";

export default async function NotebookPage() {
  const user = await getOrCreateUser();

  const [entries, submissions] = await Promise.all([
    prisma.notebookEntry.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        submission: {
          select: {
            id: true,
            verifiedText: true,
          },
        },
      },
    }),
    prisma.submission.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        verifiedText: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <section className="paper-panel-strong p-6 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="space-y-4">
            <p className="section-kicker">學習筆記</p>
            <div>
              <h1 className="text-3xl sm:text-4xl">把「這次學會了甚麼」留下來，下一篇才真的用得上</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/75">
                這裡會集中你在不同文章裡記下的句式、提醒和靈感。重點不是收藏很多，而是之後寫作時能快速翻回來，用回真正有幫助的那幾條。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="全部筆記" value={`${entries.length}`} />
            <MetricCard
              label="句式收藏"
              value={`${entries.filter((entry) => entry.entryType === "phrase").length}`}
              tone="positive"
            />
            <MetricCard
              label="寫作提醒"
              value={`${entries.filter((entry) => entry.entryType === "lesson").length}`}
              tone="primary"
            />
          </div>
        </div>
      </section>

      <NotebookWorkspace
        initialEntries={entries.map(serializeNotebookEntry)}
        submissionOptions={submissions.map((submission) => ({
          id: submission.id,
          label: previewSubmission(submission.verifiedText),
        }))}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
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
    </div>
  );
}
