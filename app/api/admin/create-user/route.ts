import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "owner") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await request.json();
  const { email, password, businessName } = body as { email?: string; password?: string; businessName?: string };
  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: "Correo y contraseña (mín. 6 caracteres) son requeridos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? "No se pudo crear la usuaria" }, { status: 400 });
  }

  // El trigger on_auth_user_created ya insertó la fila en profiles; la completamos.
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      business_name: businessName || "Mi Emprendimiento",
      subscription_status: "trial",
    })
    .eq("id", created.user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ id: created.user.id });
}
