"use client";

import { useEffect, useState } from "react";

type OrderStatus = "new" | "preparing" | "ready" | "delivered" | "cancelled";

type Props = {
  orderId: string;
  number: number;
  total: number;
  table: string;
  restaurantSlug: string;
  tableCode: string;
  onFinish: () => void;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

const steps: Array<{ key: OrderStatus; label: string }> = [
  { key: "new", label: "Recebido" },
  { key: "preparing", label: "Preparando" },
  { key: "ready", label: "Pronto" },
  { key: "delivered", label: "Entregue" },
];

export default function OrderStatusCard({
  orderId,
  number,
  total,
  table,
  restaurantSlug,
  tableCode,
  onFinish,
}: Props) {
  const [status, setStatus] = useState<OrderStatus>("new");

  useEffect(() => {
    let stopped = false;

    async function poll() {
      try {
        const params = new URLSearchParams({ restaurantSlug, tableCode });
        const response = await fetch(
          `/api/public/orders/${orderId}/status?${params.toString()}`,
          { cache: "no-store" },
        );

        if (!response.ok || stopped) return;

        const data = (await response.json()) as {
          order: { status: OrderStatus };
        };

        if (!stopped) {
          setStatus(data.order.status);
        }
      } catch {
        // Mantém o último status conhecido se uma rodada falhar.
      }
    }

    void poll();
    const timerId = window.setInterval(() => {
      void poll();
    }, 5000);

    return () => {
      stopped = true;
      window.clearInterval(timerId);
    };
  }, [orderId, restaurantSlug, tableCode]);

  const currentIndex = steps.findIndex((step) => step.key === status);

  const headline =
    status === "new"
      ? "Pedido recebido."
      : status === "preparing"
        ? "Seu pedido está sendo preparado."
        : status === "ready"
          ? "Seu pedido está pronto."
          : status === "delivered"
            ? "Pedido entregue. Bom apetite!"
            : "Este pedido foi cancelado.";

  return (
    <section className="public-order-success order-tracking">
      <span className={`success-mark ${status === "cancelled" ? "cancelled" : ""}`}>
        {status === "cancelled" ? "×" : "✓"}
      </span>
      <p className="section-kicker">Pedido #{number}</p>
      <h2>{headline}</h2>
      <p>{table} · atualização automática</p>

      {status !== "cancelled" && (
        <div className="order-progress" aria-label="Andamento do pedido">
          {steps.map((step, index) => (
            <div
              className={`order-progress-step ${index <= currentIndex ? "active" : ""}`}
              key={step.key}
            >
              <span>{index + 1}</span>
              <small>{step.label}</small>
            </div>
          ))}
        </div>
      )}

      <strong>{formatMoney(total)}</strong>

      <button className="primary-button" type="button" onClick={onFinish}>
        {status === "delivered" || status === "cancelled"
          ? "Fazer novo pedido"
          : "Voltar ao cardápio"}
      </button>
    </section>
  );
}
