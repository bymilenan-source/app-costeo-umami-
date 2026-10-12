"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Card, PrimaryButton, Toast } from "@/components/ui";
import { useToast } from "@/lib/useToast";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function PushNotificationsCard() {
  const { toast, notify } = useToast();
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setSupported(false);
        return;
      }
      setPermission(Notification.permission);
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(!!sub);
    })();
  }, []);

  const enable = async () => {
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        notify("No se activaron los avisos — permiso denegado");
        return;
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        notify("Falta configuración de notificaciones");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const subJson = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
      });
      setSubscribed(true);
      notify("Avisos activados");
    } catch {
      notify("No se pudieron activar los avisos");
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      notify("Avisos desactivados");
    } catch {
      notify("No se pudieron desactivar los avisos");
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return (
      <Card>
        <span className="text-[11px] font-medium block mb-2" style={{ color: "#7A6B66" }}>Avisos de pedidos</span>
        <p className="text-xs" style={{ color: "#8A7A75" }}>
          Tu navegador no soporta notificaciones push. Prueba desde Chrome en Android.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <span className="text-[11px] font-medium block mb-2" style={{ color: "#7A6B66" }}>Avisos de pedidos</span>
      <p className="text-xs mb-3" style={{ color: "#8A7A75" }}>
        Recibe un aviso en tu celular cuando un pedido esté por entregarse o le falte el pago, aunque no tengas la app abierta.
      </p>
      {subscribed ? (
        <button
          onClick={disable}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-lg w-full disabled:opacity-50"
          style={{ background: "#F6E3E1", color: "#B25C5C" }}
        >
          <BellOff size={14} /> {loading ? "Desactivando…" : "Desactivar avisos"}
        </button>
      ) : (
        <PrimaryButton onClick={enable} full disabled={loading}>
          <Bell size={14} /> {loading ? "Activando…" : "Activar avisos"}
        </PrimaryButton>
      )}
      {permission === "denied" && (
        <p className="text-[11px] mt-2" style={{ color: "#B25C5C" }}>
          Bloqueaste los permisos de notificación para este sitio. Actívalos desde los ajustes de Chrome (ícono del candado junto a la dirección) para poder recibir avisos.
        </p>
      )}
      <Toast message={toast} />
    </Card>
  );
}
