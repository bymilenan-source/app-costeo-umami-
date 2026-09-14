"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const router = useRouter();
  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };
  return (
    <button onClick={signOut} className={className} style={style}>
      Cerrar sesión
    </button>
  );
}
