import Link from "next/link";

export type FloorTableItem = {
  id: string;
  name: string;
  publicCode: string;
  active: boolean;
  occupied: boolean;
  startedAt: string | null;
  orderCount: number;
  total: number;
  orderStatus: "new" | "preparing" | "ready" | "delivered" | null;
  waiterRequest: boolean;
  billRequest: boolean;
  pendingCount: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function tableState(table: FloorTableItem) {
  if (!table.active) return { key: "paused", label: "Pausada" };
  if (table.billRequest) return { key: "critical", label: "Conta solicitada" };
  if (table.waiterRequest) return { key: "attention", label: "Chamando atendimento" };
  if (table.orderStatus === "ready") return { key: "ready", label: "Pedido pronto" };
  if (table.orderStatus === "preparing" || table.orderStatus === "new") {
    return { key: "working", label: table.orderStatus === "new" ? "Pedido recebido" : "Em preparo" };
  }
  if (table.occupied) return { key: "occupied", label: "Ocupada" };
  return { key: "free", label: "Livre" };
}

function startedLabel(startedAt: string | null) {
  if (!startedAt) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

export default function TableFloorMap({
  tables,
  restaurantSlug,
  title = "Mapa do salão",
}: {
  tables: FloorTableItem[];
  restaurantSlug: string;
  title?: string;
}) {
  return (
    <section className="floor-map-section">
      <div className="floor-map-heading">
        <div>
          <span className="section-kicker">Operação ao vivo</span>
          <h2>{title}</h2>
        </div>
        <div className="floor-map-legend" aria-label="Legenda">
          <span><i className="free" /> Livre</span>
          <span><i className="occupied" /> Ocupada</span>
          <span><i className="attention" /> Atenção</span>
          <span><i className="critical" /> Conta</span>
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="large-empty-state">
          <strong>Nenhuma mesa cadastrada.</strong>
          <span>Crie mesas para transformar esta área em um mapa vivo do salão.</span>
        </div>
      ) : (
        <div className="floor-map">
          {tables.map((table) => {
            const state = tableState(table);
            const duration = startedLabel(table.startedAt);

            return (
              <article className={`floor-table floor-table-${state.key}`} key={table.id}>
                <div className="floor-table-stage">
                  <div className="floor-table-shadow" />
                  <div className="floor-table-object" aria-hidden="true">
                    <span className="floor-table-top" />
                    <span className="floor-table-leg leg-a" />
                    <span className="floor-table-leg leg-b" />
                    <span className="floor-table-leg leg-c" />
                    <span className="floor-table-leg leg-d" />
                  </div>
                  <div className="floor-table-notifications">
                    {table.waiterRequest && <span className="floor-notification waiter">Atendimento</span>}
                    {table.billRequest && <span className="floor-notification bill">Conta</span>}
                    {table.orderStatus === "ready" && <span className="floor-notification ready">Pedido pronto</span>}
                    {table.pendingCount > 1 && <span className="floor-notification count">+{table.pendingCount - 1}</span>}
                  </div>
                  <div className="floor-table-name">
                    <strong>{table.name}</strong>
                    <span className={`floor-state floor-state-${state.key}`}>{state.label}</span>
                  </div>
                </div>
                <div className="floor-table-meta">
                  <span>{duration ? `ocupada há ${duration}` : table.active ? "disponível para receber clientes" : "fora de operação"}</span>
                  {table.occupied && <strong>{table.orderCount} {table.orderCount === 1 ? "pedido" : "pedidos"} · {formatMoney(table.total)}</strong>}
                </div>
                <div className="floor-table-links">
                  <Link href={`/r/${restaurantSlug}/m/${table.publicCode}`} target="_blank">Abrir mesa</Link>
                  <Link href={`/dashboard/mesas/${table.id}/qr`}>QR Code</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
