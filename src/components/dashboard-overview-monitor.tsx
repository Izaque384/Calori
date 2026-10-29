"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function payloadSignature(parts: unknown[]) {
  return JSON.stringify(parts);
}

export default function DashboardOverviewMonitor() {
  const router = useRouter();
  const signature = useRef<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState("agora");

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const [tablesResponse, ordersResponse, serviceResponse] = await Promise.all([
          fetch("/api/dashboard/tables", { cache: "no-store" }),
          fetch("/api/dashboard/orders", { cache: "no-store" }),
          fetch("/api/dashboard/service-requests", { cache: "no-store" }),
        ]);

        if (!tablesResponse.ok || !ordersResponse.ok || !serviceResponse.ok) return;

        const [tablesPayload, ordersPayload, servicePayload] = await Promise.all([
          tablesResponse.json(),
          ordersResponse.json(),
          serviceResponse.json(),
        ]);

        if (cancelled) return;

        const next = payloadSignature([
          tablesPayload.visits,
          ordersPayload.orders,
          servicePayload.requests,
        ]);

        if (signature.current === null) {
          signature.current = next;
        } else if (signature.current !== next) {
          signature.current = next;
          router.refresh();
        }

        setUpdatedAt(
          new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      } catch {
        // Mantém os dados visíveis e tenta novamente no próximo ciclo.
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(
            poll,
            document.visibilityState === "visible" ? 5000 : 30000,
          );
        }
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState !== "visible" || cancelled) return;
      if (timer) window.clearTimeout(timer);
      void poll();
    }

    timer = window.setTimeout(poll, 2500);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return (
    <div className="overview-live-status" title="O painel verifica mudanças automaticamente">
      <span aria-hidden="true" />
      <div>
        <strong>Operação ao vivo</strong>
        <small>Atualizado {updatedAt}</small>
      </div>
    </div>
  );
}
