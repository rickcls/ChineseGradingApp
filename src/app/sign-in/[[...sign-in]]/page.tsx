import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/AuthShell";
import { clerkAppearance } from "@/lib/clerkAppearance";

export default function SignInPage() {
  return (
    <AuthShell
      kicker="歡迎回來"
      title="繼續你的中文寫作旅程"
      description="登入後可以看見你最近的作品、導師建議、以及正在穩穩進步的能力地圖。慢慢來，我會陪你一篇一篇寫下去。"
      highlights={[
        { label: "回顧最近作品", hint: "看見自己一步步累積的節奏" },
        { label: "查看導師建議", hint: "每次只需專注 1–2 項重點" },
        { label: "追蹤能力地圖", hint: "把模糊的「不夠好」變成具體方向" },
      ]}
      footerLabel="還沒有帳號？"
      footerHref="/sign-up"
      footerLinkLabel="建立新帳號"
    >
      <SignIn appearance={clerkAppearance} signUpUrl="/sign-up" />
    </AuthShell>
  );
}
