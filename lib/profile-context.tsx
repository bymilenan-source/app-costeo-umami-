"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface ProfileContextValue {
  profile: Profile;
  updateProfile: (patch: Partial<Profile>) => Promise<{ error: string | null }>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ initialProfile, children }: { initialProfile: Profile; children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(initialProfile);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update(patch).eq("id", profile.id);
      if (error) return { error: error.message };
      setProfile((prev) => ({ ...prev, ...patch }));
      return { error: null };
    },
    [profile.id]
  );

  return <ProfileContext.Provider value={{ profile, updateProfile }}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile debe usarse dentro de ProfileProvider");
  return ctx;
}
