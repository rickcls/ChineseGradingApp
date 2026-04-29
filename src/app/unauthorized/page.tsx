import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="paper-panel-strong p-6 sm:p-7">
        <p className="section-kicker">沒有權限</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">這個頁面需要其他角色權限</h1>
        <p className="mt-3 text-sm leading-7 text-ink/75">
          你的登入狀態正常，只是目前角色不能查看這個區域。如需更改角色或點數，請聯絡管理員。
        </p>
        <Link href="/dashboard" className="btn-primary mt-5 inline-flex">
          返回主頁
        </Link>
      </section>
    </div>
  );
}
