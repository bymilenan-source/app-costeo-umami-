"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Wallet, Target, Trash2, Plus, Check } from "lucide-react";
import { COLORS, MONTH_NAMES, uid } from "@/lib/constants";
import { money } from "@/lib/costing";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useToast } from "@/lib/useToast";
import { Card, Field, PrimaryButton, Toast, inputStyle } from "@/components/ui";
import type { Order, Expense } from "@/lib/types";

function monthKey(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ResumenPage() {
  const { profile, updateProfile } = useProfile();
  const { toast, notify } = useToast();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ name: "", amount: "" });
  const [goalDraft, setGoalDraft] = useState(String(profile.monthly_goal || 10));

  const supabase = useMemo(() => createClient(), []);
  const key = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: o }, { data: e }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("expenses").select("*").order("created_at", { ascending: false }),
      ]);
      setOrders((o as Order[]) ?? []);
      setExpenses((e as Expense[]) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  const monthOrders = orders.filter((o) => monthKey(o.delivery_date) === key);
  const facturacion = monthOrders.reduce((s, o) => s + (Number(o.unit_price) || 0) * (Number(o.quantity) || 0), 0);
  const pendiente = monthOrders
    .filter((o) => o.status !== "pagado")
    .reduce((s, o) => {
      const total = (Number(o.unit_price) || 0) * (Number(o.quantity) || 0);
      return s + (total - (Number(o.deposit) || 0));
    }, 0);

  const monthExpenses = expenses.filter((e) => e.month === key);
  const gastosFijos = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const gananciaNeta = facturacion - gastosFijos;

  const goal = Number(profile.monthly_goal) || 10;
  const pedidosCount = monthOrders.length;
  const progressPct = Math.min(100, Math.round((pedidosCount / goal) * 100));
  const isCurrentMonth = key === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const changeMonth = (delta: number) => {
    let m = cursor.m + delta;
    let y = cursor.y;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setCursor({ y, m });
  };

  const addExpense = async () => {
    if (!expenseForm.name || !expenseForm.amount) {
      notify("Ponle nombre y monto al gasto");
      return;
    }
    const row = { id: uid(), user_id: profile.id, name: expenseForm.name, amount: parseFloat(expenseForm.amount), month: key };
    const { error } = await supabase.from("expenses").insert(row);
    if (error) { notify("No se pudo guardar el gasto"); return; }
    setExpenses([row as Expense, ...expenses]);
    setExpenseForm({ name: "", amount: "" });
    setShowExpenseForm(false);
    notify("Gasto agregado");
  };

  const removeExpense = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  const saveGoal = async () => {
    const { error } = await updateProfile({ monthly_goal: parseFloat(goalDraft) || 10 });
    notify(error ? "No se pudo actualizar la meta" : "Meta actualizada");
  };

  if (loading) {
    return <p className="text-sm text-center py-10" style={{ color: "#B0A29C" }}>Cargando…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 style={{ fontFamily: "var(--font-fraunces)", color: COLORS.plumDark }} className="text-lg font-semibold">
          Hola{profile.owner_name ? `, ${profile.owner_name}` : ""}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "#8A7A75" }}>
          {isCurrentMonth ? "Así va tu negocio este mes" : `Resumen de ${MONTH_NAMES[cursor.m]} ${cursor.y}`}
        </p>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button onClick={() => changeMonth(-1)} style={{ color: COLORS.plum }}><ChevronLeft size={20} /></button>
        <span style={{ fontFamily: "var(--font-plex-mono)", color: COLORS.plumDark }} className="text-sm font-semibold w-36 text-center capitalize">
          {MONTH_NAMES[cursor.m]} {cursor.y}
        </span>
        <button onClick={() => changeMonth(1)} style={{ color: COLORS.plum }}><ChevronRight size={20} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: "#9A8B85" }}>Facturación del mes</div>
          <div style={{ fontFamily: "var(--font-plex-mono)", color: COLORS.plumDark }} className="text-lg font-bold mt-1">{money(facturacion)}</div>
        </Card>
        <Card>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: "#9A8B85" }}>Gastos fijos del mes</div>
          <div style={{ fontFamily: "var(--font-plex-mono)", color: COLORS.plumDark }} className="text-lg font-bold mt-1">{money(gastosFijos)}</div>
        </Card>
        <Card>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: "#9A8B85" }}>Ganancia neta</div>
          <div style={{ fontFamily: "var(--font-plex-mono)", color: COLORS.sage }} className="text-lg font-bold mt-1">{money(gananciaNeta)}</div>
        </Card>
        <Card>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: "#9A8B85" }}>Pendiente de cobro</div>
          <div style={{ fontFamily: "var(--font-plex-mono)", color: "#B25C5C" }} className="text-lg font-bold mt-1">{money(pendiente)}</div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: COLORS.plumDark }}>
            <Target size={13} /> Pedidos del mes
          </div>
          <span className="text-xs" style={{ color: "#8A7A75" }}>{pedidosCount} / {goal}</span>
        </div>
        <div style={{ background: COLORS.blush, borderRadius: 999, height: 8, overflow: "hidden" }}>
          <div style={{ background: COLORS.butter, width: `${progressPct}%`, height: "100%", borderRadius: 999 }} />
        </div>
        <p className="text-[11px] mt-2" style={{ color: "#8A7A75" }}>
          {pedidosCount >= goal ? "¡Meta alcanzada este mes!" : `Te faltan ${goal - pedidosCount} pedidos para llegar a tu meta.`}
        </p>
        <div className="flex items-center gap-2 mt-3">
          <input style={{ ...inputStyle, flex: 1 }} type="number" value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} placeholder="Meta de pedidos mensual" />
          <button onClick={saveGoal} className="text-xs font-semibold px-3 py-2 rounded-lg shrink-0" style={{ background: COLORS.plum, color: "#fff" }}>Guardar meta</button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: COLORS.plumDark }}>
            <Wallet size={13} /> Gastos fijos de {MONTH_NAMES[cursor.m]}
          </div>
          <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="text-xs font-medium flex items-center gap-1" style={{ color: COLORS.plum }}>
            <Plus size={13} /> agregar
          </button>
        </div>

        {showExpenseForm && (
          <div className="flex items-center gap-2 mb-3">
            <input style={{ ...inputStyle, flex: 2 }} placeholder="Ej. Alquiler, luz, gas" value={expenseForm.name} onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })} />
            <input style={{ ...inputStyle, flex: 1 }} type="number" placeholder="RD$" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
            <button onClick={addExpense} className="shrink-0 text-xs font-semibold px-2.5 py-2 rounded-lg" style={{ background: COLORS.plum, color: "#fff" }}><Check size={14} /></button>
          </div>
        )}

        {monthExpenses.length === 0 ? (
          <p className="text-xs" style={{ color: "#B0A29C" }}>Sin gastos fijos registrados este mes.</p>
        ) : (
          <div className="space-y-1.5">
            {monthExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span style={{ color: COLORS.ink }}>{e.name}</span>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "var(--font-plex-mono)", color: "#8A7A75" }}>{money(e.amount)}</span>
                  <button onClick={() => removeExpense(e.id)} style={{ color: "#B25C5C" }}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Toast message={toast} />
    </div>
  );
}
