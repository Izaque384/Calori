"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

const tablePositions = [
  { left: 19, top: 28, scale: .96 },
  { left: 43, top: 23, scale: .92 },
  { left: 18, top: 59, scale: 1 },
  { left: 45, top: 55, scale: 1.02 },
  { left: 72, top: 52, scale: .96 },
  { left: 31, top: 82, scale: .91 },
  { left: 61, top: 80, scale: .93 },
  { left: 82, top: 77, scale: .88 },
];

const waiterRoutes = ["route-a", "route-b", "route-c"];

function tableState(table: FloorTableItem) {
  if (!table.active) return { key: "paused", label: "Pausada" };
  if (table.billRequest) return { key: "critical", label: "Conta solicitada" };
  if (table.waiterRequest) return { key: "attention", label: "Chamando garçom" };
  if (table.orderStatus === "ready") return { key: "ready", label: "Pedido pronto" };
  if (table.orderStatus === "preparing" || table.orderStatus === "new") {
    return { key: "working", label: table.orderStatus === "new" ? "Novo pedido" : "Em preparo" };
  }
  if (table.occupied) return { key: "occupied", label: "Mesa ocupada" };
  return { key: "free", label: "Mesa livre" };
}

function needsAttention(table: FloorTableItem) {
  return Boolean(table.billRequest || table.waiterRequest || table.orderStatus === "ready");
}

function notificationCopy(table: FloorTableItem) {
  if (table.billRequest) {
    return {
      eyebrow: "Solicitação da mesa",
      title: "Conta solicitada",
      text: "O cliente pediu para fechar a conta desta mesa.",
    };
  }
  if (table.waiterRequest) {
    return {
      eyebrow: "Atendimento",
      title: "Garçom solicitado",
      text: "Há um chamado aguardando atendimento nesta mesa.",
    };
  }
  if (table.orderStatus === "ready") {
    return {
      eyebrow: "Cozinha",
      title: "Pedido pronto",
      text: "O pedido desta mesa está pronto para ser servido.",
    };
  }
  if (table.orderStatus === "preparing" || table.orderStatus === "new") {
    return {
      eyebrow: "Pedido",
      title: table.orderStatus === "new" ? "Novo pedido recebido" : "Pedido em preparo",
      text: "Acompanhe o andamento do pedido desta mesa.",
    };
  }
  if (table.occupied) {
    return {
      eyebrow: "Mesa em atendimento",
      title: table.name,
      text: table.orderCount
        ? table.orderCount + " " + (table.orderCount === 1 ? "pedido vinculado" : "pedidos vinculados") + " à visita atual."
        : "A visita está ativa e ainda não possui pedidos.",
    };
  }
  return {
    eyebrow: "Mesa disponível",
    title: table.name,
    text: table.active ? "Esta mesa está livre para receber clientes." : "Esta mesa está pausada no momento.",
  };
}

export default function RestaurantOperationsScene({
  tables,
  staff,
  restaurantName,
  restaurantSlug,
  canViewReports,
  metrics,
}: Props) {
  const visibleTables = tables.slice(0, tablePositions.length);
  const hiddenTableCount = Math.max(0, tables.length - visibleTables.length);
  const waiterCount = Math.min(3, Math.max(1, staff.length));
  const kitchenCrewCount = Math.min(3, Math.max(2, Math.ceil(Math.max(1, staff.length) / 2)));
  const [activeInfo, setActiveInfo] = useState<string | null>(null);

  const alertIds = useMemo(
    () => visibleTables.filter(needsAttention).map((table) => table.id),
    [visibleTables],
  );
  const alertSignature = alertIds.join("|");

  useEffect(() => {
    if (!alertSignature) return;
    setActiveInfo(alertIds[0] ?? null);
    const timeout = window.setTimeout(() => setActiveInfo(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [alertSignature]);

  return (
    <section className="cozy-game-room" aria-label="Simulação isométrica da operação do restaurante">
      <header className="cozy-game-header">
        <div className="cozy-game-title">
          <span className="cozy-live-dot" aria-hidden="true" />
          <div>
            <small>Restaurante ao vivo</small>
            <strong>{restaurantName}</strong>
          </div>
        </div>

        <div className="cozy-game-hud" aria-label="Resumo da operação">
          <span><b>{metrics.activeTables}</b><small>mesas</small></span>
          <span><b>{metrics.activeOrders}</b><small>pedidos</small></span>
          <span className={metrics.pendingService ? "has-alert" : ""}>
            <b>{metrics.pendingService}</b><small>chamados</small>
          </span>
        </div>
      </header>

      <div className="cozy-game-scene-wrap">
        <div className="cozy-game-scene">
          <div className="cozy-floor-shadow" aria-hidden="true" />
          <div className="cozy-floor-plane" aria-hidden="true">
            <span className="cozy-floor-tile tile-a" />
            <span className="cozy-floor-tile tile-b" />
            <span className="cozy-floor-tile tile-c" />
            <span className="cozy-floor-tile tile-d" />
          </div>

          <div className="cozy-decor cozy-decor-plant-a" aria-hidden="true">
            <i /><span /><span />
          </div>
          <div className="cozy-decor cozy-decor-plant-b" aria-hidden="true">
            <i /><span /><span />
          </div>
          <div className="cozy-service-cart" aria-hidden="true">
            <span /><i /><i />
          </div>

          <section className="cozy-kitchen" aria-label="Cozinha">
            <div className="cozy-kitchen-sign">cozinha</div>
            <div className="cozy-kitchen-back" aria-hidden="true">
              <span className="cozy-kitchen-shelf" />
              <span className="cozy-pan pan-a" />
              <span className="cozy-pan pan-b" />
            </div>

            <div className="cozy-kitchen-crew" aria-hidden="true">
              {Array.from({ length: kitchenCrewCount }).map((_, index) => (
                <div className={"cozy-person cozy-cook cozy-cook-" + (index + 1)} key={index}>
                  <span className="cozy-person-shadow" />
                  <span className="cozy-person-body" />
                  <span className="cozy-person-head"><i /></span>
                  <span className="cozy-person-arm arm-left" />
                  <span className="cozy-person-arm arm-right" />
                </div>
              ))}
            </div>

            <div className="cozy-kitchen-counter" aria-hidden="true">
              <span className="cozy-counter-front" />
              <span className="cozy-stove stove-a"><i /><i /></span>
              <span className="cozy-stove stove-b"><i /><i /></span>
              <span className="cozy-prep-board" />
            </div>
          </section>

          <div className="cozy-route route-line-a" aria-hidden="true" />
          <div className="cozy-route route-line-b" aria-hidden="true" />
          <div className="cozy-route route-line-c" aria-hidden="true" />

          {visibleTables.map((table, index) => {
            const state = tableState(table);
            const position = tablePositions[index];
            const notice = notificationCopy(table);
            const alert = needsAttention(table);
            const open = activeInfo === table.id;

            return (
              <article
                className={"cozy-table cozy-table-" + state.key}
                key={table.id}
                style={{
                  left: position.left + "%",
                  top: position.top + "%",
                  transform: "translate(-50%, -50%) scale(" + position.scale + ")",
                }}
              >
                <div className="cozy-table-object" aria-hidden="true">
                  <span className="cozy-table-shadow" />
                  <span className="cozy-chair cozy-chair-north"><i /></span>
                  <span className="cozy-chair cozy-chair-east"><i /></span>
                  <span className="cozy-chair cozy-chair-south"><i /></span>
                  <span className="cozy-chair cozy-chair-west"><i /></span>
                  <span className="cozy-table-pedestal" />
                  <span className="cozy-table-top">
                    <i className="cozy-plate plate-a" />
                    <i className="cozy-plate plate-b" />
                    <i className="cozy-cup" />
                  </span>

                  {table.occupied && (
                    <>
                      <span className="cozy-diner cozy-diner-a"><i /></span>
                      <span className="cozy-diner cozy-diner-b"><i /></span>
                    </>
                  )}
                </div>

                <div className="cozy-table-ui">
                  <span className="cozy-table-name">
                    <i aria-hidden="true" />
                    {table.name}
                  </span>
                  <button
                    className={"cozy-info-button" + (alert ? " has-alert" : "")}
                    type="button"
                    aria-label={(open ? "Ocultar" : "Mostrar") + " informações de " + table.name}
                    aria-expanded={open}
                    onClick={() => setActiveInfo((current) => current === table.id ? null : table.id)}
                  >
                    i
                    {alert && <span className="cozy-info-ping" aria-hidden="true" />}
                  </button>
                </div>

                {open && (
                  <div className={"cozy-notification-popover" + (alert ? " is-alert" : "")} role="status">
                    <button type="button" aria-label="Fechar aviso" onClick={() => setActiveInfo(null)}>×</button>
                    <small>{notice.eyebrow}</small>
                    <strong>{notice.title}</strong>
                    <p>{notice.text}</p>
                    <span>{state.label}</span>
                  </div>
                )}
              </article>
            );
          })}

          {Array.from({ length: waiterCount }).map((_, index) => (
            <div
              className={"cozy-person cozy-waiter " + waiterRoutes[index]}
              key={"waiter-" + index}
              aria-hidden="true"
            >
              <span className="cozy-person-shadow" />
              <span className="cozy-person-leg leg-left" />
              <span className="cozy-person-leg leg-right" />
              <span className="cozy-person-body" />
              <span className="cozy-person-head"><i /></span>
              <span className="cozy-person-arm arm-left" />
              <span className="cozy-person-arm arm-right" />
              <span className="cozy-waiter-tray"><i /></span>
            </div>
          ))}

          {tables.length === 0 && (
            <div className="cozy-empty-state">
              <strong>Seu salão vai ganhar vida aqui.</strong>
              <span>Crie as primeiras mesas para montar a simulação da operação.</span>
              <Link href="/dashboard/mesas">Criar mesas →</Link>
            </div>
          )}
        </div>
      </div>

      <nav className="cozy-game-dock" aria-label="Atalhos da operação">
        <Link href="/dashboard/pedidos"><span>Pedidos</span><b>{metrics.activeOrders}</b></Link>
        <Link href="/dashboard/mesas"><span>Mesas</span><b>{tables.length}</b></Link>
        <Link href="/dashboard/atendimento"><span>Atendimento</span><b>{metrics.pendingService}</b></Link>
        {canViewReports && <Link href="/dashboard/relatorios"><span>Relatórios</span></Link>}
        <Link
          className="client-view"
          href={tables[0] ? "/r/" + restaurantSlug + "/m/" + tables[0].publicCode : "/dashboard/mesas"}
          target={tables[0] ? "_blank" : undefined}
        >
          <span>{tables[0] ? "Visão do cliente ↗" : "Configurar salão"}</span>
        </Link>
      </nav>

      {hiddenTableCount > 0 && (
        <div className="cozy-hidden-tables">+{hiddenTableCount} mesas fora da cena</div>
      )}
    </section>
  );
}
