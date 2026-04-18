import { SubmissionForm } from "@/components/SubmissionForm";

export const dynamic = "force-dynamic";

export default function NewSubmissionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">提交一篇新文章</h1>
        <p className="mt-1 text-sm text-muted">
          把文章直接貼在下面就可以。導師會按照你的年級，從內容、結構、語言、字詞標點、表達立意五方面給你意見，並指出 2–3 個最值得改善的重點。
        </p>
      </div>
      <SubmissionForm />
    </div>
  );
}
