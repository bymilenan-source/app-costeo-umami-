import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COLORS } from "@/lib/constants";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import type { Profile } from "@/lib/types";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "owner") redirect("/dashboard");

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <header style={{ background: COLORS.charcoal }} className="px-5 pt-6 pb-5 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div style={{ fontFamily: "var(--font-fraunces)", color: COLORS.butter }} className="text-xl font-semibold tracking-tight">
            Panel de administración
          </div>
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-xs font-medium" style={{ color: "#fff" }}>Mi cuenta</a>
            <SignOutButton className="text-xs font-medium" style={{ color: "#fff" }} />
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-5 pb-24">{children}</main>
    </div>
  );
}
