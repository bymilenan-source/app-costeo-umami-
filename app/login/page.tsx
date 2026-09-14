"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { COLORS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { Card, Field, PrimaryButton, inputStyle } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    router.push(params.get("next") || "/dashboard");
    router.refresh();
  };

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }} className="flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-5">
          <div style={{ fontFamily: "var(--font-fraunces)", color: COLORS.plumDark }} className="text-2xl font-semibold">
            Costeo UMAMI
          </div>
          <p className="text-xs mt-1" style={{ color: "#8A7A75" }}>Inicia sesión en tu cuenta</p>
        </div>
        <Card>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Correo">
              <input
                style={inputStyle}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
              />
            </Field>
            <Field label="Contraseña">
              <input
                style={inputStyle}
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            {error && (
              <p className="text-xs" style={{ color: "#B25C5C" }}>{error}</p>
            )}
            <PrimaryButton type="submit" full disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </PrimaryButton>
          </form>
        </Card>
        <p className="text-center text-xs mt-4" style={{ color: "#8A7A75" }}>
          ¿No tienes cuenta? Solicítala desde{" "}
          <Link href="/" className="font-medium" style={{ color: COLORS.plum }}>la página principal</Link>.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
