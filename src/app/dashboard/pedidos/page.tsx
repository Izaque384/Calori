import { db } from "@/db";
import { orderItems, orders, tables } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { and, asc, desc, eq } from "drizzle-orm";
import { signOut } from "../actions";
import { advanceOrder, cancelOrder } from "./actions";

export const dynamic = "force-dynamic";

function formatMoney(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function statusLabel(status: string) {
  if (status === "new") return "Novo";
  if (status === "preparing") return "Preparando";
  if (status === "ready") return "Pronto";
  if (status === "delivered") return "Entregue";
  return "Cancelado";
}

function nextActionLabel(status: string) {
  if (status === "new") return "Iniciar preparo";
  if (status === "preparing") return "Marcar como pronto";
  if (status === "ready") return "Marcar como entregue";
  return null;
}

const columns = [
  { key: "new", title: "Novos" },
  { key: "preparing", title: "Preparando" },
  { key: "ready", title: "Prontos" },
  { key: "delivered", title: "Entregues" },
] as const;

export default async function OrdersPage() {
  const { restaurant } = await requireCurrentRestaurant();

  const orderRows = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      total: orders.total,
      note: orders.note,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      tableName: tables.name,
    })
    .from(orders)
    .innerJoin(tables, eq(orders.tableId, tables.id))
    .where(eq(orders.restaurantId, restaurant.id))
    .orderBy(desc(orders.createdAt));

  const itemRows = await db
    .select({
      orderId: orderItems.orderId,
      productName: orderItems.productName,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .orderBy(asc(orderItems.productName));

  const itemsByOrder = new Map<string, Array<{ productName: string; quantity: number }>>();

  for (const item of itemRows) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push({ productName: item.productName, quantity: item.quantity });
    itemsByOrder.set(item.orderId, list);
  }

  const activeOrders = orderRows.filter((order) => order.status !== "cancelled");

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand">Calori<span>.</span></div>
        <div className="restaurant-pill">{restaurant.name}</div>
        <nav>
          <a href="/dashboard">Visão geral</a>
          <a className="active" href="/dashboard/pedidos">Pedidos</a>
          <a href="/dashboard/cardapio">Cardápio</a>
          <a href="/dashboard/mesas">Mesas</a>
          <a href="/dashboard/atendimento">Atendimento</a>
          <a href="/dashboard/configuracoes">Configurações</a>
        </nav>
        <form action={signOut}><button className="ghost-button" type="submit">Sair</button></form>
      </aside>

      <section className="dashboard-content orders-content">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Pedidos</p>
            <h1>Acompanhe a operação.</h1>
            <p className="muted">Mova cada pedido pelas etapas conforme ele avança na cozinha e no salão.</p>
          </div>
          <div className="status-chip">{activeOrders.filter((order) => order.status !== "delivered").length} em andamento</div>
        </div>

        <div className="order-board">
          {columns.map((column) => {
            const columnOrders = activeOrders.filter((order) => order.status === column.key);

            return (
              <section className="order-column" key={column.key}>
                <div className="order-column-heading">
                  <div>
                    <span className={`order-dot ${column.key}`} />
                    <strong>{column.title}</strong>
                  </div>
                  <span>{columnOrders.length}</span>
                </div>

                <div className="order-column-list">
                  {columnOrders.length === 0 ? (
                    <div className="order-empty">Nenhum pedido aqui.</div>
                  ) : (
                    columnOrders.map((order) => {
                      const items = itemsByOrder.get(order.id) ?? [];
                      const nextLabel = nextActionLabel(order.status);

                      return (
                        <article className="order-card" key={order.id}>
                          <div className="order-card-top">
                            <div>
                              <span className="order-number">#{order.number}</span>
                              <strong>{order.tableName}</strong>
                            </div>
                            <span className="order-total">{formatMoney(order.total)}</span>
                          </div>

                          <div className="order-items-summary">
                            {items.map((item, index) => (
                              <span key={`${order.id}-${index}`}>
                                {item.quantity}× {item.productName}
                              </span>
                            ))}
                          </div>

                          {order.note && <p className="order-note">Obs.: {order.note}</p>}

                          <div className="order-card-meta">
                            <span>{statusLabel(order.status)}</span>
                            <time>{new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
                          </div>

                          <div className="order-card-actions">
                            {nextLabel && (
                              <form action={advanceOrder}>
                                <input type="hidden" name="orderId" value={order.id} />
                                <button className="primary-button order-main-action" type="submit">{nextLabel}</button>
                              </form>
                            )}

                            {order.status !== "delivered" && (
                              <form action={cancelOrder}>
                                <input type="hidden" name="orderId" value={order.id} />
                                <button className="text-button danger" type="submit">Cancelar</button>
                              </form>
                            )}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {orderRows.some((order) => order.status === "cancelled") && (
          <section className="cancelled-orders">
            <div className="section-title">
              <div>
                <span className="section-kicker">Histórico</span>
                <h2>Cancelados</h2>
              </div>
            </div>
            <div className="cancelled-list">
              {orderRows.filter((order) => order.status === "cancelled").map((order) => (
                <div key={order.id}>
                  <span>#{order.number} · {order.tableName}</span>
                  <strong>{formatMoney(order.total)}</strong>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
