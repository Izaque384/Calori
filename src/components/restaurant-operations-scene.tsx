import Link from "next/link";
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
  { left: 22, top: 28, scale: .96 },
  { left: 42, top: 21, scale: .88 },
  { left: 64, top: 28, scale: 1.02 },
  { left: 79, top: 40, scale: .9 },
  { left: 26, top: 48, scale: 1.06 },
  { left: 50, top: 45, scale: .98 },
  { left: 69, top: 54, scale: 1.04 },
  { left: 19, top: 68, scale: .9 },
  { left: 41, top: 69, scale: 1.02 },
  { left: 62, top: 72, scale: .92 },
  { left: 82, top: 67, scale: 1.02 },
  { left: 50, top: 83, scale: .86 },
];

const staffPositions = [
  { left: 13, top: 39, delay: "0s" },
  { left: 88, top: 29, delay: "-1.3s" },
  { left: 11, top: 80, delay: "-2.4s" },
  { left: 87, top: 79, delay: "-3.2s" },
  { left: 51, top: 10, delay: "-4.1s" },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function roleLabel(role: string) {
  if (role === "owner") return "Responsável";
  if (role === "manager") return "Gerência";
  return "Equipe";
}

function tableState(table: FloorTableItem) {
  if (!table.active) return { key: "paused", label: "Pausada", short: "Pausa" };
  if (table.billRequest) return { key: "critical", label: "Conta solicitada", short: "Conta" };
  if (table.waiterRequest) return { key: "attention", label: "Chamando atendimento", short: "Chamado" };
  if (table.orderStatus === "ready") return { key: "ready", label: "Pedido pronto", short: "Pronto" };
  if (table.orderStatus === "preparing" || table.orderStatus === "new") {
    return {
      key: "working",
      label: table.orderStatus === "new" ? "Pedido recebido" : "Em preparo",
      short: table.orderStatus === "new" ? "Novo" : "Preparo",
    };
  }
  if (table.occupied) return { key: "occupied", label: "Mesa ocupada", short: "Ocupada" };
  return { key: "free", label: "Mesa livre", short: "Livre" };
}

function durationLabel(startedAt: string | null) {
  if (!startedAt) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
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
  const visibleStaff = staff.slice(0, staffPositions.length);
  const occupiedRate = tables.length ? Math.round((metrics.activeTables / tables.length) * 100) : 0;
  const priorities = tables.filter(
    (table) => table.billRequest || table.waiterRequest || table.orderStatus === "ready",
  );

  const metricCards = [
    { label: "Mesas ocupadas", value: String(metrics.activeTables), detail: `${occupiedRate}% do salão`, tone: "blue" },
    { label: "Pedidos ativos", value: String(metrics.activeOrders), detail: `${metrics.todayOrders} pedidos hoje`, tone: "violet" },
    { label: "Chamados", value: String(metrics.pendingService), detail: "aguardando atendimento", tone: "amber" },
    { label: "Atenção", value: String(metrics.attentionCount), detail: metrics.attentionCount ? "prioridades abertas" : "operação tranquila", tone: "red" },
    { label: "Receita hoje", value: formatMoney(metrics.todayTotal), detail: "pedidos não cancelados", tone: "green" },
  ];

  return (
    <section className="live-control-room" aria-label="Painel operacional do restaurante">
      <div className="control-room-aurora control-room-aurora-a" />
      <div className="control-room-aurora control-room-aurora-b" />
      <div className="control-room-noise" />
      <div className="control-room-grid" />

      <header className="control-room-header">
        <div className="control-room-title">
          <span className="live-status-dot" />
          <div>
            <span>Operação ao vivo</span>
            <strong>{restaurantName}</strong>
          </div>
        </div>

        <div className="control-room-legend" aria-label="Legenda">
          <span><i className="free" /> Livre</span>
          <span><i className="occupied" /> Ocupada</span>
          <span><i className="working" /> Pedido</span>
          <span><i className="attention" /> Atenção</span>
        </div>
      </header>

      <div className="control-room-metrics" aria-label="Indicadores principais">
        {metricCards.map((metric) => (
          <article className={`glass-metric glass-metric-${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>

      <div className="flow-system" aria-hidden="true">
        <div className="flow-track flow-track-a"><i /><i /><i /></div>
        <div className="flow-track flow-track-b"><i /><i /><i /></div>
        <div className="flow-track flow-track-c"><i /><i /></div>
      </div>

      <div className="clay-scene-shell">
        <div className="clay-scene">
          <div className="scene-room-platform">
            <div className="scene-room-edge scene-room-edge-left" />
            <div className="scene-room-edge scene-room-edge-right" />
            <div className="scene-kitchen-block">
              <span>Cozinha</span>
              <div className="kitchen-counter">
                <i /><i /><i />
              </div>
            </div>
            <div className="scene-pass-block">
              <span>Expedição</span>
              <i /><i />
            </div>

            {visibleTables.map((table, index) => {
              const state = tableState(table);
              const position = tablePositions[index];
              const duration = durationLabel(table.startedAt);
              const bubbleCount = table.pendingCount || (table.orderStatus === "ready" ? 1 : 0);

              return (
                <article
                  className={`clay-table clay-table-${state.key}`}
                  key={table.id}
                  style={{
                    left: `${position.left}%`,
                    top: `${position.top}%`,
                    transform: `translate(-50%, -50%) scale(${position.scale})`,
                  }}
                >
                  <div className="clay-table-notification">
                    <span>{state.short}</span>
                    {bubbleCount > 0 && <b>{bubbleCount}</b>}
                  </div>

                  <div className="clay-table-model" aria-hidden="true">
                    <span className="clay-table-shadow" />
                    <span className="clay-chair clay-chair-north" />
                    <span className="clay-chair clay-chair-east" />
                    <span className="clay-chair clay-chair-south" />
                    <span className="clay-chair clay-chair-west" />
                    <span className="clay-table-stem" />
                    <span className="clay-table-top" />
                    {table.occupied && (
                      <>
                        <span className="clay-diner clay-diner-a"><i /></span>
                        <span className="clay-diner clay-diner-b"><i /></span>
                      </>
                    )}
                    {(table.billRequest || table.waiterRequest || table.orderStatus === "ready") && (
                      <span className="clay-signal-ring" />
                    )}
                  </div>

                  <div className="clay-table-caption">
                    <strong>{table.name}</strong>
                    <span>{duration || state.label}</span>
                    {table.occupied && (
                      <small>{table.orderCount} {table.orderCount === 1 ? "pedido" : "pedidos"} · {formatMoney(table.total)}</small>
                    )}
                  </div>
                </article>
              );
            })}

            {visibleStaff.map((member, index) => {
              const position = staffPositions[index];
              return (
                <div
                  className={`clay-person clay-person-${member.role}`}
                  key={member.id}
                  style={{
                    left: `${position.left}%`,
                    top: `${position.top}%`,
                    animationDelay: position.delay,
                  }}
                  title="Representação visual da equipe cadastrada; não é rastreamento de localização"
                >
                  <span className="clay-person-bubble">
                    <strong>{member.name}</strong>
                    <small>{roleLabel(member.role)}</small>
                  </span>
                  <span className="clay-person-shadow" />
                  <span className="clay-person-leg clay-person-leg-a" />
                  <span className="clay-person-leg clay-person-leg-b" />
                  <span className="clay-person-body" />
                  <span className="clay-person-arm clay-person-arm-a" />
                  <span className="clay-person-arm clay-person-arm-b" />
                  <span className="clay-person-head">
                    <i className="clay-person-hair" />
                  </span>
                </div>
              );
            })}

            {tables.length === 0 && (
              <div className="control-room-empty glass-panel">
                <span>Salão vazio</span>
                <strong>Construa sua cena operacional.</strong>
                <p>Cadastre as primeiras mesas para transformar esta tela em um mapa vivo do restaurante.</p>
                <Link href="/dashboard/mesas">Criar mesas →</Link>
              </div>
            )}

            {hiddenTableCount > 0 && (
              <div className="hidden-tables-chip">+{hiddenTableCount} mesas além da cena</div>
            )}
          </div>
        </div>
      </div>

      <aside className="priority-glass glass-panel">
        <div className="priority-glass-heading">
          <div>
            <span>Prioridades</span>
            <strong>{priorities.length ? "Ação necessária" : "Tudo sob controle"}</strong>
          </div>
          <Link href="/dashboard/atendimento">Abrir fila →</Link>
        </div>

        <div className="priority-glass-list">
          {priorities.length ? priorities.slice(0, 3).map((table) => {
            const state = tableState(table);
            return (
              <div className={`priority-glass-row priority-${state.key}`} key={table.id}>
                <i />
                <span><strong>{table.name}</strong><small>{state.label}</small></span>
                <b>{table.pendingCount || 1}</b>
              </div>
            );
          }) : (
            <p>Nenhum chamado, conta ou pedido pronto aguardando ação.</p>
          )}
        </div>
      </aside>

      <nav className="control-room-dock glass-panel" aria-label="Atalhos do painel">
        <Link href="/dashboard/pedidos">Pedidos</Link>
        <Link href="/dashboard/atendimento">Atendimento</Link>
        <Link href="/dashboard/mesas">Mesas</Link>
        {canViewReports && <Link href="/dashboard/relatorios">Relatórios</Link>}
        <Link
          href={tables[0] ? `/r/${restaurantSlug}/m/${tables[0].publicCode}` : "/dashboard/mesas"}
          target={tables[0] ? "_blank" : undefined}
        >
          {tables[0] ? "Visão do cliente ↗" : "Configurar salão"}
        </Link>
      </nav>
    </section>
  );
}
