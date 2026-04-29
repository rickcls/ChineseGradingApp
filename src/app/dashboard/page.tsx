import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardRedirectPage() {
  const role = await getCurrentUserRole();

  if (role === "admin") redirect("/admin/dashboard");
  if (role === "teacher") redirect("/teacher/dashboard");
  redirect("/student/dashboard");
}
