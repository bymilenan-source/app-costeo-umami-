import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COLORS } from "@/lib/constants";
import { NavTabs } from "@/components/dashboard/NavTabs";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { ProfileProvider } from "@/lib/profile-context";
import type { Profile } from "@/lib/types";
import type { ReactNode } from "react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/login");

  const blocked = profile.subscription_status === "expired" && profile.role !== "owner";

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <header style={{ background: COLORS.plum }} className="px-5 pt-6 pb-5 sticky top-0 z-20 shadow-sm print:hidden">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {profile.logo_url && (
              <div
                className="shrink-0 overflow-hidden"
                style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={profile.logo_url} alt={profile.business_name} className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <div style={{ fontFamily: "var(--font-fraunces)" }} className="text-white text-2xl font-semibold tracking-tight">
                {profile.business_name || "Mi Emprendimiento"}
              </div>
              <div style={{ color: COLORS.blush }} className="text-xs mt-0.5">Costeo, precios y facturas en un solo lugar</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile.role === "owner" && (
              <a href="/admin" className="text-xs font-medium" style={{ color: COLORS.blush }}>Panel admin</a>
            )}
            <SignOutButton className="text-xs font-medium" style={{ color: COLORS.blush }} />
          </div>
        </div>
      </header>

      {!blocked && <NavTabs />}

      <main className="max-w-3xl mx-auto px-4 py-5 pb-24">
        {blocked ? (
          <div className="text-center py-16">
            <div style={{ fontFamily: "var(--font-fraunces)", color: COLORS.plumDark }} className="text-xl font-semibold">
              Tu suscripción venció
            </div>
            <p className="text-sm mt-2 max-w-sm mx-auto" style={{ color: "#8A7A75" }}>
              Contacta a Chef Milena / UMAMI para renovar tu acceso y seguir usando la app.
            </p>
          </div>
        ) : (
          <ProfileProvider initialProfile={profile}>{children}</ProfileProvider>
        )}
      </main>
    </div>
  );
}
