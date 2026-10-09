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
  { left: 27, top: 27, scale: .92 },
  { left: 50, top: 23, scale: .88 },
  { left: 73, top: 29, scale: .92 },
  { left: 28, top: 56, scale: .94 },
  { left: 55, top: 55, scale: .96 },
  { left: 78, top: 59, scale: .9 },
  { left: 40, top: 81, scale: .88 },
  { left: 67, top: 80, scale: .88 },
];

const staffRoutes = [
  { route: "horizontal", delay: "-2s" },
  { route: "vertical", delay: "-7s" },
  { route: "horizontal", delay: "-10s" },
];

function roleLabel(role: string) {
  if (role === "owner") return "Responsável";
  if (role === "manager") return "Gerência";
  return "Equipe";
}

function tableState(table: FloorTableItem) {
  if (!table.active) return { key: "paused", label: "Pausada" };
  if (table.billRequest) return { key: "critical", label: "Conta" };
  if (table.waiterRequest) return { key: "attention", label: "Chamado" };
  if (table.orderStatus === "ready") return { key: "ready", label: "Pronto" };
  if (table.orderStatus === "preparing" || table.orderStatus === "new") {
    return { key: "working", label: table.orderStatus === "new" ? "Novo pedido" : "Em preparo" };
  }
  if (table.occupied) return { key: "occupied", label: "Ocupada" };
  return { key: "free", label: "Livre" };
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
  const visibleStaff = staff.slice(0, staffRoutes.length);
  const occupiedRate = tables.length ? Math.round((metrics.activeTables / tables.length) * 100) : 0;

  const metricCards = [
    {
      label: "Mesas ocupadas",
      value: String(metrics.activeTables),
      detail: tables.length ? `${occupiedRate}% do salão` : "nenhuma mesa",
    },
    {
      label: "Pedidos ativos",
      value: String(metrics.activeOrders),
      detail: `${metrics.todayOrders} hoje`,
    },
    {
      label: "Chamados",
      value: String(metrics.pendingService),
      detail: metrics.attentionCount ? `${metrics.attentionCount} prioridade(s)` : "sem pendências",
    },
  ];

  return (
    <section className="simple-ops-room" aria-label="Painel operacional do restaurante">
      <header className="simple-ops-header">
        <div className="simple-ops-title">
          <span className="simple-live-dot" />
          <div>
            <small>Operação ao vivo</small>
            <strong>{restaurantName}</strong>
          </div>
        </div>

        <nav className="simple-ops-links" aria-label="Atalhos">
          <Link href="/dashboard/pedidos">Pedidos</Link>
          <Link href="/dashboard/mesas">Mesas</Link>
          {canViewReports && <Link href="/dashboard/relatorios">Relatórios</Link>}
          <Link
            className="simple-client-link"
            href={tables[0] ? `/r/${restaurantSlug}/m/${tables[0].publicCode}` : "/dashboard/mesas"}
            target={tables[0] ? "_blank" : undefined}
          >
            {tables[0] ? "Visão do cliente ↗" : "Configurar salão"}
          </Link>
        </nav>
      </header>

      <div className="simple-ops-metrics" aria-label="Indicadores principais">
        {metricCards.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>

      <div className="simple-scene-shell">
        <div className="simple-scene-floor">
          <div className="simple-floor-counter" aria-hidden="true">
            <span />
            <i />
            <i />
          </div>

          <div className="simple-walk-lane simple-walk-lane-horizontal" aria-hidden="true" />
          <div className="simple-walk-lane simple-walk-lane-vertical" aria-hidden="true" />

          {visibleTables.map((table, index) => {
            const state = tableState(table);
            const position = tablePositions[index];
            const needsAttention = table.billRequest || table.waiterRequest || table.orderStatus === "ready";

            return (
              <article
                className={`simple-table simple-table-${state.key}`}
                key={table.id}
                style={{
                  left: `${position.left}%`,
                  top: `${position.top}%`,
                  transform: `translate(-50%, -50%) scale(${position.scale})`,
                }}
              >
                <div className="simple-table-model" aria-hidden="true">
                  <span className="simple-table-shadow" />
                  <span className="simple-chair simple-chair-north" />
                  <span className="simple-chair simple-chair-east" />
                  <span className="simple-chair simple-chair-south" />
                  <span className="simple-chair simple-chair-west" />
                  <span className="simple-table-leg" />
                  <span className="simple-table-top" />
                  {table.occupied && (
                    <>
                      <span className="simple-guest simple-guest-a" />
                      <span className="simple-guest simple-guest-b" />
                    </>
                  )}
                  {needsAttention && <span className="simple-attention-pulse" />}
                </div>

                <div className="simple-table-label">
                  <strong>{table.name}</strong>
                  <span><i />{state.label}</span>
                  {table.occupied && (
                    <small>{table.orderCount} {table.orderCount === 1 ? "pedido" : "pedidos"}</small>
                  )}
                </div>
              </article>
            );
          })}

          {visibleStaff.map((member, index) => {
            const route = staffRoutes[index];
            return (
              <div
                className={`simple-worker simple-worker-${route.route} simple-worker-${member.role}`}
                key={member.id}
                style={{ animationDelay: route.delay }}
                title={`${member.name} · ${roleLabel(member.role)}. Representação visual, sem rastreamento de localização.`}
                aria-label={`${member.name}, ${roleLabel(member.role)}`}
              >
                <span className="simple-worker-shadow" />
                <span className="simple-worker-leg simple-worker-leg-a" />
                <span className="simple-worker-leg simple-worker-leg-b" />
                <span className="simple-worker-body" />
                <span className="simple-worker-head"><i /></span>
              </div>
            );
          })}

          {tables.length === 0 && (
            <div className="simple-empty-state">
              <strong>Seu salão aparece aqui.</strong>
              <span>Crie as primeiras mesas para montar a visão operacional.</span>
              <Link href="/dashboard/mesas">Criar mesas →</Link>
            </div>
          )}
        </div>
      </div>

      <footer className="simple-ops-footer">
        <div className="simple-ops-legend" aria-label="Legenda">
          <span><i className="free" /> Livre</span>
          <span><i className="occupied" /> Ocupada</span>
          <span><i className="working" /> Pedido</span>
          <span><i className="attention" /> Atenção</span>
        </div>
        {hiddenTableCount > 0 && <small>+{hiddenTableCount} mesas fora desta visualização</small>}
      </footer>
    </section>
  );
}
