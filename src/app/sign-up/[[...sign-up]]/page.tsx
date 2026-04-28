import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/AuthShell";
import { clerkAppearance } from "@/lib/clerkAppearance";

export default function SignUpPage() {
  return (
    <AuthShell
      kicker="開始第一篇"
      title="把寫作變成一件可以慢慢進步的事"
      description="建立帳號後，你交出的每一篇文章都會被細心標註、整理、追蹤。你不需要一次寫得完美，只要願意開始。"
      highlights={[
        { label: "拍照或直接輸入", hint: "用最自在的方式交稿" },
        { label: "溫和而具體的回饋", hint: "看見亮點，再挑 1–2 項先練" },
        { label: "屬於你自己的進步紀錄", hint: "每一次練習都被好好保留" },
      ]}
      footerLabel="已經有帳號？"
      footerHref="/sign-in"
      footerLinkLabel="返回登入"
    >
      <SignUp appearance={clerkAppearance} signInUrl="/sign-in" />
    </AuthShell>
  );
}
