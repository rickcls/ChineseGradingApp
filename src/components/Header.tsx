import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-serif text-xl">
          AI 中文寫作導師
        </Link>
        <nav className="flex gap-6 text-sm">
          <Link href="/" className="hover:text-accent">主頁</Link>
          <Link href="/submissions/new" className="hover:text-accent">新作提交</Link>
          <Link href="/weaknesses" className="hover:text-accent">重點回顧</Link>
        </nav>
      </div>
    </header>
  );
}
