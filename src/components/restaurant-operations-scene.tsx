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
  restaurantSlug: string;
  canViewReports: boolean;
  metrics: SceneMetrics;
};

const tablePositions = [
  { left: 19, top: 28 },
  { left: 42, top: 23 },
  { left: 66, top: 27 },
  { left: 82, top: 40 },
  { left: 24, top: 49 },
  { left: 49, top: 46 },
  { left: 70, top: 52 },
  { left: 18, top: 70 },
  { left: 43, top: 70 },
  { left: 67, top: 73 },
  { left: 84, top: 68 },
  { left: 52, top: 84 },
];

const staffPositions = [
  { left: 9, top: 42 },
  { left: 91, top: 28 },
  { left: 10, top: 80 },
  { left: 90, top: 79 },
  { left: 51, top: 11 },
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
  if (!table.active) return { key: "paused", label: "Pausada" };
  if (table.billRequest) return { key: "critical", label: "Conta" };
  if (table.waiterRequest) return { key: "attention", label: "Atendimento" };
  if (table.orderStatus === "ready") return { key: "ready", label: "Pronto" };
  if (table.orderStatus === "preparing" || table.orderStatus === "new") {
    return { key: "working", label: table.orderStatus === "new" ? "Recebido" : "Em preparo" };
  }
  if (table.occupied) return { key: "occupied", label: "Ocupada" };
  return { key: "free", label: "Livre" };
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
  restaurantSlug,
  canViewReports,
  metrics,
}: Props) {
  const visibleTables = tables.slice(0, tablePositions.length);
  const hiddenTableCount = Math.max(0, tables.length - visibleTables.length);
  const visibleStaff = staff.slice(0, staffPositions.length);
  const occupiedRate = tables.length ? Math.round((metrics.activeTables / tables.length) * 100) : 0;
  const priorities = tables
    .filter((table) => table.billRequest || table.waiterRequest || table.orderStatus === "ready")
    .slice(0, 5);

  return (
    <section className="ops-studio">
      <div className="ops-scene-card">
        <div className="ops-scene-topbar">
          <div>
            <span className="section-kicker">Cena operacional</span>
            <h2>Salão em perspectiva</h2>
            <p>Uma leitura visual do restaurante com mesas, equipe cadastrada e sinais de atenção.</p>
          </div>
          <div className="ops-scene-legend" aria-label="Legenda do salão">
            <span><i className="free" /> Livre</span>
            <span><i className="occupied" /> Ocupada</span>
            <span><i className="attention" /> Atenção</span>
            <span><i className="critical" /> Conta</span>
          </div>
        </div>

        <div className="ops-scene-scroll">
          <div className="ops-scene-board">
            <div className="ops-scene-zone ops-scene-zone-kitchen">
              <span>Cozinha</span>
              <i />
              <i />
              <i />
            </div>
            <div className="ops-scene-zone ops-scene-zone-counter">
              <span>Expedição</span>
              <i />
              <i />
            </div>

            <div className="ops-scene-hud">
              <span><small>ocupadas</small><strong>{metrics.activeTables}</strong></span>
              <span><small>pedidos ativos</small><strong>{metrics.activeOrders}</strong></span>
              <span className={metrics.attentionCount ? "alert" : ""}><small>atenção</small><strong>{metrics.attentionCount}</strong></span>
              <span><small>hoje</small><strong>{formatMoney(metrics.todayTotal)}</strong></span>
            </div>

            {visibleTables.map((table, index) => {
              const state = tableState(table);
              const position = tablePositions[index];
              const duration = durationLabel(table.startedAt);
              return (
                <article
                  className={`scene-table scene-table-${state.key}`}
                  key={table.id}
                  style={{ left: `${position.left}%`, top: `${position.top}%` }}
                >
                  <div className="scene-table-model" aria-hidden="true">
                    <span className="scene-chair chair-north" />
                    <span className="scene-chair chair-east" />
                    <span className="scene-chair chair-south" />
                    <span className="scene-chair chair-west" />
                    <span className="scene-table-shadow" />
                    <span className="scene-table-base" />
                    <span className="scene-table-top" />
                    {(table.billRequest || table.waiterRequest || table.orderStatus === "ready") && (
                      <span className="scene-table-pulse" />
                    )}
                  </div>
                  <div className="scene-table-label">
                    <span>
                      <strong>{table.name}</strong>
                      <small>{duration ? duration : state.label}</small>
                    </span>
                    <b>{state.label}</b>
                  </div>
                </article>
              );
            })}

            {visibleStaff.map((member, index) => {
              const position = staffPositions[index];
              return (
                <div
                  className={`scene-staff scene-staff-${member.role}`}
                  key={member.id}
                  style={{ left: `${position.left}%`, top: `${position.top}%` }}
                  title="Posição visual da equipe cadastrada, não rastreamento em tempo real"
                >
                  <span className="scene-staff-shadow" />
                  <span className="scene-staff-body" />
                  <span className="scene-staff-head">{member.name.slice(0, 1).toUpperCase()}</span>
                  <span className="scene-staff-tag">
                    <strong>{member.name}</strong>
                    <small>{roleLabel(member.role)}</small>
                  </span>
                </div>
              );
            })}

            {tables.length === 0 && (
              <div className="ops-scene-empty">
                <strong>O salão começa aqui.</strong>
                <span>Cadastre as mesas para construir a cena operacional.</span>
                <Link href="/dashboard/mesas">Criar mesas →</Link>
              </div>
            )}

            {hiddenTableCount > 0 && (
              <div className="ops-scene-overflow">+{hiddenTableCount} mesas fora da cena</div>
            )}
          </div>
        </div>

        <div className="ops-scene-footer">
          <span>Equipe mostrada como mapa visual; o Calori não rastreia localização física.</span>
          <Link href={tables[0] ? `/r/${restaurantSlug}/m/${tables[0].publicCode}` : "/dashboard/mesas"} target={tables[0] ? "_blank" : undefined}>
            {tables[0] ? "Abrir uma mesa como cliente ↗" : "Configurar salão →"}
          </Link>
        </div>
      </div>

      <aside className="ops-companion-panel">
        <section className="ops-panel-card ops-panel-card-emphasis">
          <div className="ops-panel-heading">
            <div>
              <span className="section-kicker">Indicadores</span>
              <h3>Ritmo da operação</h3>
            </div>
            <span className="ops-live-dot">ao vivo</span>
          </div>

          <div className="ops-kpi-grid">
            <div><strong>{metrics.todayOrders}</strong><span>pedidos hoje</span></div>
            <div><strong>{metrics.activeOrders}</strong><span>em andamento</span></div>
            <div><strong>{metrics.pendingService}</strong><span>chamados</span></div>
            <div><strong>{formatMoney(metrics.todayTotal)}</strong><span>total do dia</span></div>
          </div>

          <div className="ops-occupancy">
            <div><span>Ocupação do salão</span><strong>{occupiedRate}%</strong></div>
            <div className="ops-progress"><i style={{ width: `${Math.min(100, occupiedRate)}%` }} /></div>
            <small>{metrics.activeTables} de {tables.length} mesas ocupadas</small>
          </div>
        </section>

        <section className="ops-panel-card">
          <div className="ops-panel-heading">
            <div>
              <span className="section-kicker">Prioridades</span>
              <h3>O que pede atenção</h3>
            </div>
            <Link href="/dashboard/atendimento">Fila →</Link>
          </div>

          <div className="ops-priority-list">
            {priorities.length ? priorities.map((table) => {
              const state = tableState(table);
              return (
                <div className={`ops-priority-row ${state.key}`} key={table.id}>
                  <span className="ops-priority-icon" />
                  <div><strong>{table.name}</strong><small>{state.label}</small></div>
                  <b>{table.pendingCount || (table.orderStatus === "ready" ? 1 : 0)}</b>
                </div>
              );
            }) : (
              <div className="ops-calm-state">
                <strong>Operação tranquila.</strong>
                <span>Nenhum chamado, conta ou pedido pronto aguardando ação.</span>
              </div>
            )}
          </div>
        </section>

        <section className="ops-panel-card">
          <div className="ops-panel-heading">
            <div>
              <span className="section-kicker">Equipe mapeada</span>
              <h3>Acessos do restaurante</h3>
            </div>
          </div>

          <div className="ops-staff-list">
            {staff.slice(0, 5).map((member) => (
              <div className="ops-staff-row" key={member.id}>
                <span>{member.name.slice(0, 1).toUpperCase()}</span>
                <div><strong>{member.name}</strong><small>{roleLabel(member.role)}</small></div>
              </div>
            ))}
            {!staff.length && <small className="ops-empty-copy">Nenhum membro cadastrado.</small>}
          </div>
        </section>

        <section className="ops-panel-links">
          <Link href="/dashboard/pedidos">Pedidos <span>→</span></Link>
          <Link href="/dashboard/mesas">Mesas <span>→</span></Link>
          {canViewReports && <Link href="/dashboard/relatorios">Relatórios <span>→</span></Link>}
        </section>
      </aside>
    </section>
  );
}
