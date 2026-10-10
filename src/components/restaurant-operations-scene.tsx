"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FloorTableItem } from "@/components/table-floor-map";

export type SceneStaffItem = {
  id: string;
  name: string;
  role: string;
};

type SceneMetrics = {
  activeTables: number;
  activeOrders: number;
  pendingService: number;
  attentionCount: number;
  todayOrders: number;
  todayTotal: number;
};

type Props = {
  tables: FloorTableItem[];
  staff: SceneStaffItem[];
  restaurantName: string;
  restaurantSlug: string;
  canViewReports: boolean;
  metrics: SceneMetrics;
};

type TablePosition = {
  left: number;
  top: number;
  scale: number;
  popover: "left" | "right";
};

const TABLE_POSITIONS: TablePosition[] = [
  { left: 15, top: 23, scale: .95, popover: "right" },
  { left: 37, top: 20, scale: .91, popover: "right" },
  { left: 59, top: 24, scale: .95, popover: "left" },
  { left: 17, top: 53, scale: 1, popover: "right" },
  { left: 41, top: 50, scale: .98, popover: "right" },
  { left: 63, top: 54, scale: .96, popover: "left" },
  { left: 28, top: 80, scale: .92, popover: "right" },
  { left: 54, top: 79, scale: .92, popover: "left" },
];

const STAFF_ROUTES = ["route-one", "route-two", "route-three"];

function tableState(table: FloorTableItem) {
  if (!table.active) return { key: "paused", label: "Pausada" };
  if (table.billRequest) return { key: "bill", label: "Conta solicitada" };
  if (table.waiterRequest) return { key: "attention", label: "Chamando equipe" };
  if (table.orderStatus === "ready") return { key: "ready", label: "Pedido pronto" };
  if (table.orderStatus === "preparing" || table.orderStatus === "new") {
    return { key: "working", label: table.orderStatus === "new" ? "Novo pedido" : "Em preparo" };
  }
  if (table.occupied) return { key: "occupied", label: "Ocupada" };
  return { key: "free", label: "Livre" };
}

function isAlert(table: FloorTableItem) {
  return Boolean(table.billRequest || table.waiterRequest || table.orderStatus === "ready");
}

function tableDetail(table: FloorTableItem) {
  if (table.billRequest) return ["Conta solicitada", "A mesa está aguardando o fechamento da conta."];
  if (table.waiterRequest) return ["Atendimento solicitado", "Há um chamado aguardando a equipe."];
  if (table.orderStatus === "ready") return ["Pedido pronto", "O pedido está pronto para sair da cozinha."];
  if (table.orderStatus === "preparing") return ["Em preparo", "A cozinha está preparando o pedido desta mesa."];
  if (table.orderStatus === "new") return ["Novo pedido", "Um novo pedido entrou para esta mesa."];
  if (table.occupied) {
    return [
      "Mesa em atendimento",
      table.orderCount
        ? table.orderCount + " " + (table.orderCount === 1 ? "pedido ativo" : "pedidos ativos") + "."
        : "Visita ativa, ainda sem pedido.",
    ];
  }
  return [table.active ? "Mesa livre" : "Mesa pausada", table.active ? "Disponível para receber clientes." : "Fora de operação no momento."];
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function signatureFromPayload(parts: unknown[]) {
  return JSON.stringify(parts);
}

export default function RestaurantOperationsScene({
  tables,
  staff,
  restaurantName,
  restaurantSlug,
  canViewReports,
  metrics,
}: Props) {
  const router = useRouter();
  const [openTable, setOpenTable] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState("agora");
  const liveSignature = useRef<string | null>(null);

  const visibleTables = tables.slice(0, TABLE_POSITIONS.length);
  const hiddenTableCount = Math.max(0, tables.length - visibleTables.length);
  const alertTables = useMemo(() => visibleTables.filter(isAlert), [visibleTables]);
  const alertSignature = alertTables.map((table) => table.id).join("|");
  const activeWaiters = Math.min(3, Math.max(1, staff.length || 1));
  const kitchenCrew = Math.min(3, Math.max(2, Math.ceil(Math.max(1, staff.length) / 2)));

  useEffect(() => {
    if (!alertSignature) return;
    setOpenTable(alertTables[0]?.id ?? null);
    const timer = window.setTimeout(() => setOpenTable(null), 4800);
    return () => window.clearTimeout(timer);
  }, [alertSignature]);

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

        const nextSignature = signatureFromPayload([
          tablesPayload.visits,
          ordersPayload.orders,
          servicePayload.requests,
        ]);

        if (liveSignature.current === null) {
          liveSignature.current = nextSignature;
        } else if (nextSignature !== liveSignature.current) {
          liveSignature.current = nextSignature;
          router.refresh();
        }

        setUpdatedAt(
          new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      } catch {
        // O dashboard mantém a cena atual quando uma atualização isolada falha.
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

    timer = window.setTimeout(poll, 3500);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router]);

  const occupancy = tables.length ? Math.round((metrics.activeTables / tables.length) * 100) : 0;

  return (
    <section className="ops-home" aria-label="Visão geral operacional do restaurante">
      <header className="ops-home-header">
        <div className="ops-brand-status">
          <span className="ops-live-mark" aria-hidden="true" />
          <div>
            <small>salão ao vivo</small>
            <strong>{restaurantName}</strong>
          </div>
          <span className="ops-updated">atualizado {updatedAt}</span>
        </div>

        <div className="ops-metrics" aria-label="Indicadores principais">
          <article>
            <span>Ocupação</span>
            <strong>{occupancy}%</strong>
            <small>{metrics.activeTables}/{tables.length || 0} mesas</small>
          </article>
          <article>
            <span>Pedidos ativos</span>
            <strong>{metrics.activeOrders}</strong>
            <small>{metrics.todayOrders} hoje</small>
          </article>
          <article className={metrics.pendingService ? "attention" : ""}>
            <span>Atendimento</span>
            <strong>{metrics.pendingService}</strong>
            <small>{metrics.pendingService ? "aguardando equipe" : "sem chamados"}</small>
          </article>
          <article>
            <span>Hoje</span>
            <strong>{money(metrics.todayTotal)}</strong>
            <small>vendas registradas</small>
          </article>
        </div>
      </header>

      <div className="ops-world">
        <div className="ops-world-glow" aria-hidden="true" />

        <div className="ops-floor">
          <div className="ops-floor-header" aria-hidden="true">
            <span>salão</span>
            <i />
          </div>

          <div className="ops-path path-a" aria-hidden="true" />
          <div className="ops-path path-b" aria-hidden="true" />
          <div className="ops-path path-c" aria-hidden="true" />

          <div className="ops-plant plant-a" aria-hidden="true"><i /><b /><b /></div>
          <div className="ops-plant plant-b" aria-hidden="true"><i /><b /><b /></div>
          <div className="ops-host-stand" aria-hidden="true"><span /><i /></div>

          {visibleTables.map((table, index) => {
            const position = TABLE_POSITIONS[index];
            const state = tableState(table);
            const alert = isAlert(table);
            const open = openTable === table.id;
            const [detailTitle, detailText] = tableDetail(table);

            return (
              <article
                className={"ops-table ops-table-" + state.key}
                key={table.id}
                style={{
                  left: position.left + "%",
                  top: position.top + "%",
                  transform: "translate(-50%, -50%) scale(" + position.scale + ")",
                }}
              >
                <div className="ops-table-asset" aria-hidden="true">
                  <span className="ops-table-ground-shadow" />
                  <span className="ops-chair chair-top" />
                  <span className="ops-chair chair-right" />
                  <span className="ops-chair chair-bottom" />
                  <span className="ops-chair chair-left" />
                  <span className="ops-table-base" />
                  <span className="ops-table-surface">
                    <i className="dish dish-a" />
                    <i className="dish dish-b" />
                    <i className="glass" />
                  </span>
                  {table.occupied && (
                    <>
                      <span className="ops-customer customer-a"><i /></span>
                      <span className="ops-customer customer-b"><i /></span>
                    </>
                  )}
                </div>

                <div className="ops-table-caption">
                  <span><i />{table.name}</span>
                  <button
                    type="button"
                    className={"ops-info" + (alert ? " has-alert" : "")}
                    aria-label={(open ? "Ocultar" : "Mostrar") + " detalhes de " + table.name}
                    aria-expanded={open}
                    onClick={() => setOpenTable((current) => current === table.id ? null : table.id)}
                  >
                    i
                    {alert && <b aria-hidden="true" />}
                  </button>
                </div>

                {open && (
                  <div className={"ops-popover popover-" + position.popover + (alert ? " is-alert" : "")} role="status">
                    <button type="button" aria-label="Fechar" onClick={() => setOpenTable(null)}>×</button>
                    <small>{state.label}</small>
                    <strong>{detailTitle}</strong>
                    <p>{detailText}</p>
                    {table.occupied && (
                      <div>
                        <span>{table.orderCount} {table.orderCount === 1 ? "pedido" : "pedidos"}</span>
                        <span>{money(table.total)}</span>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {Array.from({ length: activeWaiters }).map((_, index) => (
            <div className={"ops-person ops-waiter " + STAFF_ROUTES[index]} key={"waiter-" + index} aria-hidden="true">
              <span className="ops-person-shadow" />
              <span className="ops-person-head"><i /></span>
              <span className="ops-person-body" />
              <span className="ops-person-arm arm-a" />
              <span className="ops-person-arm arm-b" />
              <span className="ops-person-feet" />
              {index === 0 && <span className="ops-tray"><i /></span>}
            </div>
          ))}

          <aside className="ops-kitchen" aria-label="Cozinha">
            <div className="ops-kitchen-label"><span /> cozinha</div>
            <div className="ops-kitchen-wall" aria-hidden="true">
              <span className="ops-shelf" />
              <i className="pan pan-a" />
              <i className="pan pan-b" />
            </div>

            <div className="ops-kitchen-people" aria-hidden="true">
              {Array.from({ length: kitchenCrew }).map((_, index) => (
                <div className="ops-person ops-cook" key={index}>
                  <span className="ops-person-shadow" />
                  <span className="ops-person-head"><i /></span>
                  <span className="ops-person-body" />
                  <span className="ops-person-arm arm-a" />
                  <span className="ops-person-arm arm-b" />
                </div>
              ))}
            </div>

            <div className="ops-counter" aria-hidden="true">
              <span className="counter-front" />
              <span className="mini-stove stove-a"><i /><i /></span>
              <span className="mini-stove stove-b"><i /><i /></span>
              <span className="prep-board" />
            </div>
          </aside>

          {tables.length === 0 && (
            <div className="ops-empty">
              <span className="ops-empty-icon" aria-hidden="true">+</span>
              <strong>Monte seu salão.</strong>
              <p>Crie as primeiras mesas para o Calori transformar a operação em um mapa vivo.</p>
              <Link href="/dashboard/mesas">Criar mesas</Link>
            </div>
          )}
        </div>
      </div>

      <nav className="ops-dock" aria-label="Atalhos do restaurante">
        <Link href="/dashboard/pedidos"><span>Pedidos</span><b>{metrics.activeOrders}</b></Link>
        <Link href="/dashboard/mesas"><span>Mesas</span><b>{tables.length}</b></Link>
        <Link className={metrics.pendingService ? "attention" : ""} href="/dashboard/atendimento">
          <span>Atendimento</span><b>{metrics.pendingService}</b>
        </Link>
        {canViewReports && <Link href="/dashboard/relatorios"><span>Relatórios</span></Link>}
        <Link
          className="ops-client-link"
          href={tables[0] ? "/r/" + restaurantSlug + "/m/" + tables[0].publicCode : "/dashboard/mesas"}
          target={tables[0] ? "_blank" : undefined}
        >
          <span>{tables[0] ? "Visão do cliente ↗" : "Configurar salão"}</span>
        </Link>
      </nav>

      {hiddenTableCount > 0 && <span className="ops-more-tables">+{hiddenTableCount} mesas</span>}
    </section>
  );
}
