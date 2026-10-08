"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type OrderSnapshot = {
  id: string;
  number: number;
  status: string;
  updatedAt: string;
  createdAt: string;
};

type Props = {
  initialOrders: OrderSnapshot[];
};

export default function OrdersMonitor({ initialOrders }: Props) {
  const router = useRouter();
  const known = useRef(
    new Map(initialOrders.map((order) => [order.id, `${order.status}:${order.updatedAt}`])),
  );
  const [newOrderNumber, setNewOrderNumber] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState("agora");

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const response = await fetch("/api/dashboard/orders", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as { orders: OrderSnapshot[] };
        if (cancelled) return;

        const next = new Map(
          data.orders.map((order) => [order.id, `${order.status}:${order.updatedAt}`]),
        );

        const fresh = data.orders.filter((order) => !known.current.has(order.id));
        const changed = data.orders.some(
          (order) => known.current.get(order.id) !== `${order.status}:${order.updatedAt}`,
        );

        if (fresh.length > 0) {
          const newest = fresh.reduce((latest, order) =>
            new Date(order.createdAt) > new Date(latest.createdAt) ? order : latest,
          );
          setNewOrderNumber(newest.number);
        }

        if (fresh.length > 0 || changed || next.size !== known.current.size) {
          router.refresh();
        }

        known.current = next;
        setLastUpdated(
          new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        );
      } catch {
        // Uma falha isolada não interrompe o painel.
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(
            poll,
            document.visibilityState === "visible" ? 5000 : 30000,
          );
        }
      }
    }

    function handleVisibility() {
      if (document.visibilityState !== "visible" || cancelled) return;
      if (timer) window.clearTimeout(timer);
      void poll();
    }

    timer = window.setTimeout(poll, 5000);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router]);

  return (
    <div className="orders-monitor">
      <span className="monitor-live-dot" />
      <span>Atualização automática · {lastUpdated}</span>

      {newOrderNumber !== null && (
        <button
          type="button"
          className="new-order-toast"
          onClick={() => setNewOrderNumber(null)}
        >
          <strong>Novo pedido recebido</strong>
          <span>Pedido #{newOrderNumber}</span>
        </button>
      )}
    </div>
  );
}
