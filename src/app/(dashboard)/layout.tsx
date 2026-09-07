import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/");
  async function logout() { "use server"; await signOut({ redirectTo: "/" }); }
  return <AppShell user={{ login: session.user.login, avatarUrl: session.user.avatarUrl }} logout={logout}>{children}</AppShell>;
}
