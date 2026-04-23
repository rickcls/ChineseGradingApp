import { SubmissionForm } from "@/components/SubmissionForm";

export const dynamic = "force-dynamic";

export default function NewSubmissionPage() {
  return (
    <div className="space-y-6">
      <section className="paper-panel-strong p-6 sm:p-7">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
          <div>
            <p className="section-kicker">新作提交</p>
            <h1 className="mt-2 text-3xl sm:text-4xl">讓我們一起看看這篇文章想說什麼</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/75">
              這裡不是考場，也不是冷冰冰的評分機。你先交出一版，導師會按照你的年級，用溫和而具體的方式告訴你亮點在哪裡、下一步先改什麼。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="paper-panel-muted px-4 py-4">
              <p className="section-kicker">內容</p>
              <p className="mt-2 text-sm leading-7 text-ink/80">先讀懂你想表達的中心，再看材料是否夠具體。</p>
            </div>
            <div className="paper-panel-muted px-4 py-4">
              <p className="section-kicker">結構</p>
              <p className="mt-2 text-sm leading-7 text-ink/80">看看段落銜接和敘述節奏是否更清楚。</p>
            </div>
            <div className="paper-panel-muted px-4 py-4">
              <p className="section-kicker">語言</p>
              <p className="mt-2 text-sm leading-7 text-ink/80">從用詞、句式、字詞標點裡挑出最值得先修的地方。</p>
            </div>
          </div>
        </div>
      </section>
      <SubmissionForm />
    </div>
  );
}
