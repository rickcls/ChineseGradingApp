// Shown instead of the AI 參考範文 while a teacher's assignment keeps it locked.
export function ModelPassageLockedNotice() {
  return (
    <div className="paper-panel-muted px-5 py-4">
      <p className="section-kicker">AI 參考範文（未開放）</p>
      <p className="mt-2 text-sm leading-7 text-ink/80">
        這是老師佈置的寫作任務。為了讓你先用自己的文字完成和修改，AI 參考範文要等老師開放後才會出現。批註、改寫指南和訂正工作台都可以照常使用。
      </p>
    </div>
  );
}
