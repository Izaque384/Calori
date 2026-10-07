import { db } from "@/db";
import { orders, tableSessions, tables } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { and, asc, eq, gt, inArray, ne } from "drizzle-orm";
import Link from "next/link";
import { signOut } from "../actions";
import { closeTableVisit, createTable, toggleTable } from "./actions";

export const dynamic = "force-dynamic";

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default async function TablesPage() {
  const { restaurant, role } = await requireCurrentRestaurant();
  const canManage = role === "owner" || role === "manager";

  const rows = await db
    .select()
    .from(tables)
    .where(eq(tables.restaurantId, restaurant.id))
    .orderBy(asc(tables.name));

  const activeSessions = await db
    .select({
      id: tableSessions.id,
      tableId: tableSessions.tableId,
      createdAt: tableSessions.createdAt,
      expiresAt: tableSessions.expiresAt,
    })
    .from(tableSessions)
    .where(
      and(
        eq(tableSessions.restaurantId, restaurant.id),
        gt(tableSessions.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(tableSessions.createdAt));

  const activeSessionIds = activeSessions.map((session) => session.id);

  const activeOrders = activeSessionIds.length
    ? await db
        .select({
          tableId: orders.tableId,
          sessionId: orders.sessionId,
          total: orders.total,
          status: orders.status,
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurant.id),
            inArray(orders.sessionId, activeSessionIds),
            ne(orders.status, "cancelled"),
          ),
        )
    : [];

  const operationalByTable = new Map<
    string,
    {
      occupied: boolean;
      startedAt: Date | null;
      sessionCount: number;
      orderCount: number;
      total: number;
    }
  >();

  for (const table of rows) {
    const sessions = activeSessions.filter((session) => session.tableId === table.id);
    const sessionIds = new Set(sessions.map((session) => session.id));
    const tableOrders = activeOrders.filter(
      (order) => order.sessionId && sessionIds.has(order.sessionId),
    );

    operationalByTable.set(table.id, {
      occupied: sessions.length > 0,
      startedAt: sessions[0]?.createdAt ?? null,
      sessionCount: sessions.length,
      orderCount: tableOrders.length,
      total: tableOrders.reduce((sum, order) => sum + Number(order.total), 0),
    });
  }

  const occupiedCount = [...operationalByTable.values()].filter((item) => item.occupied).length;

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand">Calori<span>.</span></div>
        <div className="restaurant-pill">{restaurant.name}</div>
        <nav>
          <a href="/dashboard">Visão geral</a>
          <a href="/dashboard/pedidos">Pedidos</a>
          {role !== "staff" && <a href="/dashboard/cardapio">Cardápio</a>}
          <a className="active" href="/dashboard/mesas">Mesas</a>
          <a href="/dashboard/atendimento">Atendimento</a>
          {role !== "staff" && <a href="/dashboard/relatorios">Relatórios</a>}
          {role === "owner" && <a href="/dashboard/equipe">Equipe</a>}
          {role === "owner" && <a href="/dashboard/assinatura">Assinatura</a>}
          {role === "owner" && <a href="/dashboard/configuracoes">Configurações</a>}
        </nav>
        <form action={signOut}><button className="ghost-button" type="submit">Sair</button></form>
      </aside>

      <section className="dashboard-content menu-content">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Mesas</p>
            <h1>Operação do salão.</h1>
            <p className="muted">Acompanhe quais mesas estão em uso, o consumo atual e os QR Codes de acesso.</p>
          </div>
          <div className="status-chip">{occupiedCount} {occupiedCount === 1 ? "ocupada" : "ocupadas"}</div>
        </div>

        {canManage && (
          <section className="panel-card tables-create-card">
            <div className="section-title">
              <div>
                <span className="section-kicker">Nova mesa</span>
                <h2>Adicionar mesa</h2>
              </div>
            </div>
            <form action={createTable} className="inline-form">
              <input name="name" required placeholder="Ex.: Mesa 1, Varanda 2..." />
              <button className="primary-button compact" type="submit">Criar mesa</button>
            </form>
          </section>
        )}

        <section className="products-section">
          <div className="section-title">
            <div>
              <span className="section-kicker">Salão</span>
              <h2>Mesas cadastradas</h2>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="large-empty-state">
              <strong>Nenhuma mesa cadastrada.</strong>
              <span>Crie a primeira mesa acima para gerar o QR Code de acesso ao cardápio.</span>
            </div>
          ) : (
            <div className="table-card-grid">
              {rows.map((table) => {
                const operation = operationalByTable.get(table.id) ?? {
                  occupied: false,
                  startedAt: null,
                  sessionCount: 0,
                  orderCount: 0,
                  total: 0,
                };

                return (
                  <article
                    className={`table-card operational-table-card ${operation.occupied ? "occupied" : "free"}`}
                    key={table.id}
                  >
                    <div className="table-card-head">
                      <div>
                        <span className={`table-operation-status ${operation.occupied ? "occupied" : "free"}`}>
                          {operation.occupied ? "Ocupada" : "Livre"}
                        </span>
                        <h3>{table.name}</h3>
                      </div>
                      <span className="table-code">{table.publicCode}</span>
                    </div>

                    {operation.occupied ? (
                      <div className="table-operation-summary">
                        <div>
                          <span>Consumo atual</span>
                          <strong>{formatMoney(operation.total)}</strong>
                        </div>
                        <div>
                          <span>Pedidos</span>
                          <strong>{operation.orderCount}</strong>
                        </div>
                        <div>
                          <span>Desde</span>
                          <strong>
                            {operation.startedAt
                              ? operation.startedAt.toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <p className="table-free-copy">Nenhuma sessão ativa nesta mesa.</p>
                    )}

                    <div className="table-card-actions">
                      <Link className="secondary-link-button" href={`/dashboard/mesas/${table.id}/qr`}>Ver QR Code</Link>
                      <Link className="text-link-button" href={`/r/${restaurant.slug}/m/${table.publicCode}`} target="_blank">Abrir cardápio</Link>

                      {canManage && operation.occupied && (
                        <form action={closeTableVisit}>
                          <input type="hidden" name="tableId" value={table.id} />
                          <button className="text-button danger" type="submit">Encerrar visita</button>
                        </form>
                      )}

                      {canManage ? (
                        <form action={toggleTable}>
                          <input type="hidden" name="tableId" value={table.id} />
                          <input type="hidden" name="active" value={String(table.active)} />
                          <button className={table.active ? "availability-button on" : "availability-button off"} type="submit">
                            {table.active ? "Ativa" : "Pausada"}
                          </button>
                        </form>
                      ) : (
                        <span className={table.active ? "availability-button on" : "availability-button off"}>
                          {table.active ? "Ativa" : "Pausada"}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
