import { StatePanel } from "@/components/StatePanel";

export default function Loading() {
  return (
    <div className="space-y-4">
      <StatePanel
        state="loading"
        title="導師正在鋪開今天的頁面"
        description="畫面和回饋會慢慢整理好，不會一下子塞滿。稍等一下，我們馬上開始。"
      />
    </div>
  );
}
