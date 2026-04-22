import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { RevisionComparison } from "@/components/RevisionComparison";
import { StatePanel } from "@/components/StatePanel";
import { normalizeRevisionPriorities } from "@/lib/revisionPriority";

export const dynamic = "force-dynamic";

export default async function SubmissionComparePage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const submission = await prisma.submission.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      errors: { orderBy: { charOffsetStart: "asc" } },
      revisionOrigin: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!submission) notFound();

  const revision = submission.revisionOrigin[0];
  const analysis = submission.analyses[0];

  if (!revision) {
    return (
      <div className="space-y-4">
        <Link href={`/submissions/${submission.id}`} className="btn-secondary inline-flex">
          返回回饋頁
        </Link>
        <StatePanel
          state="empty"
          title="還沒有修訂版本"
          description="先在回饋頁的訂正工作台改一版，我就能幫你整理成修改前後對照，讓你更容易看見自己已經做了哪些調整。"
          actionHref={`/submissions/${submission.id}`}
          actionLabel="前往開始修訂"
        />
      </div>
    );
  }

  const delta = (revision.improvementDelta || {}) as Record<string, unknown>;
  const changedEvidence = submission.errors
    .filter((error) => !includesNormalized(revision.revisedText, error.evidenceSpan))
    .slice(0, 4)
    .map((error) => ({
      id: error.id,
      evidenceSpan: error.evidenceSpan,
      suggestion: error.suggestion,
    }));
  const remainingEvidence = submission.errors
    .filter((error) => includesNormalized(revision.revisedText, error.evidenceSpan))
    .slice(0, 4)
    .map((error) => ({
      id: error.id,
      evidenceSpan: error.evidenceSpan,
      suggestion: error.suggestion,
    }));

  return (
    <div className="space-y-6">
      <Link href={`/submissions/${submission.id}`} className="btn-secondary inline-flex">
        返回回饋頁
      </Link>

      <RevisionComparison
        beforeText={submission.verifiedText}
        afterText={revision.revisedText}
        priorities={normalizeRevisionPriorities(analysis?.revisionPriorities)
          .slice(0, 3)
          .map((p) => p.issue)}
        createdAt={revision.createdAt}
        changedEvidenceCount={numeric(delta.changedEvidenceCount, changedEvidence.length)}
        totalEvidenceCount={numeric(delta.totalEvidenceCount, submission.errors.length)}
        beforeChars={numeric(delta.beforeChars, Array.from(submission.verifiedText).length)}
        afterChars={numeric(delta.afterChars, Array.from(revision.revisedText).length)}
        changedEvidence={changedEvidence}
        remainingEvidence={remainingEvidence}
      />
    </div>
  );
}

function includesNormalized(haystack: string, needle: string) {
  const normalizedHaystack = haystack.replace(/\s+/g, "");
  const normalizedNeedle = needle.replace(/\s+/g, "");
  return normalizedNeedle ? normalizedHaystack.includes(normalizedNeedle) : false;
}

function numeric(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
