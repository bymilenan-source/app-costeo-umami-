import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Order } from "@/lib/types";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();

  const today = new Date();
  const todayStr = toDateStr(today);
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - 1);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + 2);

  const { data: orders } = await admin
    .from("orders")
    .select("*")
    .neq("status", "pagado")
    .not("delivery_date", "is", null)
    .gte("delivery_date", toDateStr(windowStart))
    .lte("delivery_date", toDateStr(windowEnd))
    .or(`last_notified_on.is.null,last_notified_on.neq.${todayStr}`);

  const pending = (orders as Order[] | null) ?? [];
  if (pending.length === 0) return NextResponse.json({ sent: 0 });

  const byUser = new Map<string, Order[]>();
  for (const order of pending) {
    const list = byUser.get(order.user_id) ?? [];
    list.push(order);
    byUser.set(order.user_id, list);
  }

  let sent = 0;

  for (const [userId, userOrders] of byUser) {
    const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", userId);
    if (!subs || subs.length === 0) continue;

    for (const order of userOrders) {
      const isToday = order.delivery_date === todayStr;
      const paymentNote = order.status === "pendiente" ? "sin abono" : "con abono parcial";
      const title = isToday ? "Entrega hoy" : "Entrega próxima";
      const body = `${order.client_name} — ${order.product_name} — ${paymentNote} — entrega ${order.delivery_date}`;
      const payload = JSON.stringify({ title, body, url: `/dashboard/pedidos/${order.id}/factura` });

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent++;
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await admin.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }

      await admin.from("orders").update({ last_notified_on: todayStr }).eq("id", order.id);
    }
  }

  return NextResponse.json({ sent });
}
