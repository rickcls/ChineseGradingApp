import Link from "next/link";
import { notFound } from "next/navigation";
import { ManuscriptSheet, circledNumber } from "@/components/ManuscriptSheet";
import { PrintButton } from "@/components/PrintButton";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { layoutManuscript, markKindFor } from "@/lib/manuscript";
import { normalizeRevisionPriorities } from "@/lib/revisionPriority";
import { DEFAULT_WRITING_RUBRIC, dseLevelFromScore, type DseLevel } from "@/lib/rubric";
import { toTeacherReviewView } from "@/lib/teacherReview";

export const dynamic = "force-dynamic";

const COLUMNS = 20;

export default async function SubmissionReportPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { appUser: user } = await requireRole(["student", "admin"]);

  const submission = await prisma.submission.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          teacherReviews: { orderBy: { updatedAt: "desc" }, take: 1, include: { reviewer: { select: { name: true } } } },
        },
      },
      errors: true,
    },
  });
  if (!submission) notFound();

  const analysis = submission.analyses[0];
  if (!analysis) notFound();

  const scores = analysis.scores as Record<string, unknown>;
  const dseLevel: DseLevel =
    typeof scores.dse_level === "string" ? (scores.dse_level as DseLevel) : dseLevelFromScore(analysis.overallScore);
  const teacherReview = analysis.teacherReviews[0] ? toTeacherReviewView(analysis.teacherReviews[0]) : null;
  const strengths = Array.isArray(analysis.strengths) ? (analysis.strengths as unknown[]).filter((s): s is string => typeof s === "string") : [];
  const priorities = normalizeRevisionPriorities(analysis.revisionPriorities).slice(0, 3);

  // Annotations the student reported as wrong are left out of the report.
  // Sort exactly as layoutManuscript numbers spans, so ① in the grid is ① below.
  const notes = submission.errors
    .filter((error) => error.studentReaction !== "wrong")
    .sort((a, b) => a.charOffsetStart - b.charOffsetStart || a.charOffsetEnd - b.charOffsetEnd);
  const rows = layoutManuscript(
    submission.verifiedText,
    notes.map((error) => ({ start: error.charOffsetStart, end: error.charOffsetEnd, kind: markKindFor(error) })),
    COLUMNS,
  );

  return (
    <div className="report-page mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/submissions/${submission.id}`} className="btn-secondary">
          返回作品頁
        </Link>
        <PrintButton />
      </div>

      <section className="paper-panel-strong p-6 print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="section-kicker">中文寫作批改報告</p>
            <h1 className="mt-2 text-2xl sm:text-3xl">{submission.taskPrompt ? `《${submission.taskPrompt}》` : "命題寫作"}</h1>
            <p className="mt-2 text-sm text-muted">
              {user.name}・{user.gradeLevel}
              {submission.genre ? `・${submission.genre}` : ""}・
              {submission.createdAt.toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-[1rem] border-2 px-4 py-3 text-center" style={{ borderColor: "#c8372d", color: "#c8372d" }}>
              <div className="font-serif text-3xl leading-none">L{dseLevel}</div>
              <div className="mt-1 text-[0.68rem]">AI 估算等級</div>
            </div>
            {teacherReview ? (
              <div className="rounded-[1rem] border-2 border-good px-4 py-3 text-center text-good">
                <div className="font-serif text-3xl leading-none">L{teacherReview.dseLevel}</div>
                <div className="mt-1 text-[0.68rem]">{teacherReview.reviewerName} 老師評定</div>
              </div>
            ) : null}
          </div>
        </div>

        <ul className="mt-4 flex flex-wrap gap-2 text-sm">
          {DEFAULT_WRITING_RUBRIC.criteria.map((criterion) => (
            <li key={criterion.key} className="pill">
              {criterion.label} {Number(scores[criterion.key]) || 0} / {criterion.maxScore}
            </li>
          ))}
          {Number(scores.typo_bonus) < 0 ? <li className="pill">錯別字 {Number(scores.typo_bonus)}</li> : null}
          <li className="pill">總分 {analysis.overallScore.toFixed(0)}</li>
        </ul>
      </section>

      <section className="space-y-2 print:break-inside-auto">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3.5 w-3.5 rounded-full border-[1.5px]" style={{ borderColor: "#c8372d" }} />
            錯別字／標點
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="underline decoration-wavy" style={{ textDecorationColor: "#c8372d" }}>
              字句
            </span>
            用詞、語法、表達
          </span>
          <span style={{ color: "#c8372d" }}>①</span>
          <span>對應下方批註</span>
        </div>
        <ManuscriptSheet rows={rows} columns={COLUMNS} />
      </section>

      {notes.length > 0 ? (
        <section className="paper-panel p-5 print:border-0 print:p-0 print:shadow-none">
          <h2 className="text-xl">批註</h2>
          <ol className="mt-3 space-y-3 text-sm leading-7">
            {notes.map((error, index) => (
              <li key={error.id} className="break-inside-avoid">
                <span className="mr-1" style={{ color: "#c8372d" }}>
                  {circledNumber(index + 1)}
                </span>
                <span className="font-medium text-ink">
                  「{error.evidenceSpan.length > 24 ? `${error.evidenceSpan.slice(0, 24)}…` : error.evidenceSpan}」
                </span>
                <span className="ml-2 text-xs text-muted">
                  {error.category}・{error.subcategory}
                  {error.ocrSuspect ? "・OCR 可能讀錯" : ""}
                </span>
                <p className="text-ink/85">{error.suggestion}</p>
                {error.exampleFix ? <p className="text-good">可改為：{error.exampleFix}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
        <div className="paper-panel p-5 print:border-0 print:p-0 print:shadow-none">
          <h2 className="text-xl">導師評語</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink/85">{analysis.coachFeedbackText}</p>
          {teacherReview?.comment ? (
            <>
              <h3 className="mt-4 font-medium text-ink">老師評語</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-ink/85">{teacherReview.comment}</p>
            </>
          ) : null}
        </div>
        <div className="paper-panel p-5 print:border-0 print:p-0 print:shadow-none">
          {strengths.length > 0 ? (
            <>
              <h2 className="text-xl">亮點</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-7 text-ink/85">
                {strengths.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
          {priorities.length > 0 ? (
            <>
              <h2 className="mt-4 text-xl">最值得先改</h2>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-7 text-ink/85">
                {priorities.map((priority, index) => (
                  <li key={`${priority.issue}-${index}`}>
                    {priority.focus ? `【${priority.focus}】` : ""}
                    {priority.issue}
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </div>
      </section>

      <p className="text-center text-xs text-muted">
        本報告由 AI 生成，等級為估算，只供學習參考；如有老師評分，請以老師評分為準。
      </p>
    </div>
  );
}
