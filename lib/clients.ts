import type { Order } from "@/lib/types";

// Los clientes se derivan de los pedidos ya guardados (no hay tabla aparte):
// cada pedido nuevo con el mismo teléfono —o el mismo nombre si no hay
// teléfono— se agrupa en el mismo cliente.
export interface ClientSummary {
  key: string;
  name: string;
  phone: string;
  orderCount: number;
  totalSpent: number;
  balance: number;
  lastOrder: Order;
}

export const phoneDigits = (p: string) => (p || "").replace(/\D/g, "");
const normName = (n: string) =>
  (n || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const clientKey = (name: string, phone: string) => {
  const d = phoneDigits(phone);
  return d.length >= 7 ? `t:${d.slice(-10)}` : `n:${normName(name)}`;
};

const orderTotal = (o: Order) => (Number(o.unit_price) || 0) * (Number(o.quantity) || 0);

export function deriveClients(orders: Order[]): ClientSummary[] {
  const map = new Map<string, ClientSummary>();
  // orders se recorren del más reciente al más antiguo
  const sorted = [...orders].sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
  for (const o of sorted) {
    if (!o.client_name?.trim()) continue;
    const key = clientKey(o.client_name, o.client_phone);
    const total = orderTotal(o);
    const balance = o.status === "pagado" ? 0 : Math.max(0, total - (Number(o.deposit) || 0));
    const c = map.get(key);
    if (!c) {
      map.set(key, {
        key,
        name: o.client_name.trim(),
        phone: o.client_phone || "",
        orderCount: 1,
        totalSpent: total,
        balance,
        lastOrder: o,
      });
    } else {
      c.orderCount += 1;
      c.totalSpent += total;
      c.balance += balance;
      if (!c.phone && o.client_phone) c.phone = o.client_phone;
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function matchClients(clients: ClientSummary[], query: string, limit = 5) {
  const q = normName(query);
  const qd = phoneDigits(query);
  if (!q && !qd) return [];
  return clients
    .filter((c) => normName(c.name).includes(q) || (qd.length >= 3 && phoneDigits(c.phone).includes(qd)))
    .slice(0, limit);
}

export const whatsappLink = (phone: string) => {
  let d = phoneDigits(phone);
  if (d.length === 10) d = `1${d}`; // RD: 809/829/849 + 7 dígitos
  return `https://wa.me/${d}`;
};
