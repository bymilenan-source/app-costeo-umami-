"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, X, Plus } from "lucide-react";
import { COLORS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/useToast";
import { Card, Field, PrimaryButton, SectionTitle, Toast, inputStyle } from "@/components/ui";
import type { Profile, SubscriptionRequest } from "@/lib/types";

const STATUS_LABEL: Record<Profile["subscription_status"], { label: string; color: string; bg: string }> = {
  active: { label: "Activa", color: "#4E7A50", bg: "#E4F0E4" },
  trial: { label: "Prueba", color: "#A9822F", bg: "#FBF0D8" },
  expired: { label: "Vencida", color: "#B25C5C", bg: "#F6E3E1" },
};

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const { toast, notify } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ businessName: "", email: "", password: "" });

  const load = async () => {
    const [{ data: u }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("subscription_requests").select("*").order("created_at", { ascending: false }),
    ]);
    setUsers((u as Profile[]) ?? []);
    setRequests((r as SubscriptionRequest[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const setSubscription = async (id: string, patch: Partial<Profile>) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) { notify("No se pudo actualizar"); return; }
    setUsers(users.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  };

  const setRequestStatus = async (id: string, status: SubscriptionRequest["status"]) => {
    await supabase.from("subscription_requests").update({ status }).eq("id", id);
    setRequests(requests.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const createUser = async () => {
    if (!newUser.email || !newUser.password) { notify("Completa correo y contraseña"); return; }
    setCreating(true);
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const body = await res.json();
    setCreating(false);
    if (!res.ok) { notify(body.error || "No se pudo crear la cuenta"); return; }
    notify("Cuenta creada");
    setShowCreate(false);
    setNewUser({ businessName: "", email: "", password: "" });
    load();
  };

  if (loading) return <p className="text-sm text-center py-10" style={{ color: "#B0A29C" }}>Cargando…</p>;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <SectionTitle sub="Solicitudes enviadas desde la página principal.">Solicitudes de suscripción</SectionTitle>
        </div>
        <div className="space-y-2">
          {requests.length === 0 && <p className="text-sm" style={{ color: "#B0A29C" }}>No hay solicitudes.</p>}
          {requests.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-sm" style={{ color: COLORS.plumDark }}>{r.name}</div>
                  <div className="text-xs" style={{ color: "#8A7A75" }}>{r.contact}</div>
                  {r.message && <p className="text-xs mt-1" style={{ color: "#8A7A75" }}>{r.message}</p>}
                </div>
                <select
                  value={r.status}
                  onChange={(e) => setRequestStatus(r.id, e.target.value as SubscriptionRequest["status"])}
                  className="text-[11px] rounded-md border px-1.5 py-1"
                  style={{ borderColor: COLORS.line }}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="contactada">Contactada</option>
                  <option value="convertida">Convertida</option>
                  <option value="descartada">Descartada</option>
                </select>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionTitle sub="Activa o desactiva el acceso de cada usuaria según su pago.">Usuarias</SectionTitle>
          <button onClick={() => setShowCreate(!showCreate)} className="text-xs font-medium flex items-center gap-1" style={{ color: COLORS.plum }}>
            <Plus size={13} /> nueva cuenta
          </button>
        </div>

        {showCreate && (
          <Card style={{ marginBottom: 12 }}>
            <div className="space-y-3">
              <Field label="Nombre del negocio">
                <input style={inputStyle} value={newUser.businessName} onChange={(e) => setNewUser({ ...newUser, businessName: e.target.value })} />
              </Field>
              <Field label="Correo de acceso">
                <input style={inputStyle} type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </Field>
              <Field label="Contraseña temporal (mín. 6 caracteres)">
                <input style={inputStyle} type="text" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
              </Field>
              <PrimaryButton onClick={createUser} full disabled={creating}>{creating ? "Creando…" : "Crear cuenta"}</PrimaryButton>
            </div>
          </Card>
        )}

        <div className="space-y-2">
          {users.map((u) => {
            const st = STATUS_LABEL[u.subscription_status];
            return (
              <Card key={u.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: COLORS.plumDark }}>
                      {u.business_name} {u.role === "owner" && <span className="text-[10px] font-normal" style={{ color: "#8A7A75" }}>(admin)</span>}
                    </div>
                    <div className="text-xs truncate" style={{ color: "#8A7A75" }}>{u.email}</div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <label className="text-[11px]" style={{ color: "#7A6B66" }}>
                    Pagó el
                    <input
                      type="date"
                      style={{ ...inputStyle, marginTop: 4 }}
                      value={u.subscription_paid_at ?? ""}
                      onChange={(e) => setSubscription(u.id, { subscription_paid_at: e.target.value || null })}
                    />
                  </label>
                  <label className="text-[11px]" style={{ color: "#7A6B66" }}>
                    Vence el
                    <input
                      type="date"
                      style={{ ...inputStyle, marginTop: 4 }}
                      value={u.subscription_due_at ?? ""}
                      onChange={(e) => setSubscription(u.id, { subscription_due_at: e.target.value || null })}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => setSubscription(u.id, { subscription_status: "active" })}
                    className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-2 rounded-lg"
                    style={{ background: COLORS.sageBg, color: "#4E7A50" }}
                  >
                    <Check size={13} /> Activar
                  </button>
                  <button
                    onClick={() => setSubscription(u.id, { subscription_status: "expired" })}
                    className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-2 rounded-lg"
                    style={{ background: "#F6E3E1", color: "#B25C5C" }}
                  >
                    <X size={13} /> Desactivar
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
      <Toast message={toast} />
    </div>
  );
}
