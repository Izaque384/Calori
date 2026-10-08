"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type TableVisitSnapshot = {
  id: string;
  tableId: string;
  openedAt: string;
  orderCount: number;
  total: number;
};

function snapshotSignature(visits: TableVisitSnapshot[]) {
  return visits
    .map((visit) =>
      [
        visit.id,
        visit.tableId,
        visit.openedAt,
        visit.orderCount,
        Number(visit.total).toFixed(2),
      ].join(":"),
    )
    .sort()
    .join("|");
}

export default function TablesMonitor({
  initialVisits,
}: {
  initialVisits: TableVisitSnapshot[];
}) {
  const router = useRouter();
  const initialSignature = useMemo(
    () => snapshotSignature(initialVisits),
    [initialVisits],
  );
  const signature = useRef(initialSignature);
  const [lastUpdated, setLastUpdated] = useState("agora");

  useEffect(() => {
    signature.current = initialSignature;
  }, [initialSignature]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const response = await fetch("/api/dashboard/tables", {
          cache: "no-store",
        });
        if (!response.ok) return;

        const data = (await response.json()) as { visits: TableVisitSnapshot[] };
        if (cancelled) return;

        const nextSignature = snapshotSignature(data.visits);
        if (nextSignature !== signature.current) {
          signature.current = nextSignature;
          router.refresh();
        }

        setLastUpdated(
          new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        );
      } catch {
        // Uma falha isolada não interrompe o salão.
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
    <div className="tables-monitor">
      <span className="monitor-live-dot" />
      <span>Atualização automática · {lastUpdated}</span>
    </div>
  );
}
