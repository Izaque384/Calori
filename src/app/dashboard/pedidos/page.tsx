import { db } from "@/db";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { orderItemOptions, orderItems, orders, tables } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { advanceOrder, cancelOrder } from "./actions";
import OrdersMonitor from "./orders-monitor";

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
  const { restaurant, role } = await requireCurrentRestaurant();

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
    .orderBy(desc(orders.createdAt))
    .limit(100);

  const visibleOrderIds = orderRows.map((order) => order.id);

  const itemRows = visibleOrderIds.length
    ? await db
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          productName: orderItems.productName,
          quantity: orderItems.quantity,
          note: orderItems.note,
        })
        .from(orderItems)
        .where(inArray(orderItems.orderId, visibleOrderIds))
        .orderBy(asc(orderItems.productName))
    : [];

  const visibleItemIds = itemRows.map((item) => item.id);

  const optionRows = visibleItemIds.length
    ? await db
        .select({
          orderItemId: orderItemOptions.orderItemId,
          name: orderItemOptions.name,
          price: orderItemOptions.price,
        })
        .from(orderItemOptions)
        .where(inArray(orderItemOptions.orderItemId, visibleItemIds))
        .orderBy(asc(orderItemOptions.name))
    : [];

  const optionsByItem = new Map<string, Array<{ name: string; price: string }>>();
  for (const option of optionRows) {
    const list = optionsByItem.get(option.orderItemId) ?? [];
    list.push({ name: option.name, price: option.price });
    optionsByItem.set(option.orderItemId, list);
  }

  const itemsByOrder = new Map<
    string,
    Array<{
      id: string;
      productName: string;
      quantity: number;
      note: string | null;
      options: Array<{ name: string; price: string }>;
    }>
  >();

  for (const item of itemRows) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      note: item.note,
      options: optionsByItem.get(item.id) ?? [],
    });
    itemsByOrder.set(item.orderId, list);
  }

  const activeOrders = orderRows.filter((order) => order.status !== "cancelled");

  return (
    <main className="dashboard-shell">
      <DashboardSidebar restaurantName={restaurant.name} role={role} activePath="/dashboard/pedidos" />

      <section className="dashboard-content orders-content">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Pedidos</p>
            <h1>Acompanhe a operação.</h1>
            <p className="muted">Novos pedidos aparecem automaticamente e cada item mantém adicionais e observações visíveis para a equipe.</p>
          </div>
          <div className="status-chip">{activeOrders.filter((order) => order.status !== "delivered").length} em andamento</div>
        </div>

        <OrdersMonitor
          initialOrders={orderRows.map((order) => ({
            id: order.id,
            number: order.number,
            status: order.status,
            updatedAt: order.updatedAt.toISOString(),
            createdAt: order.createdAt.toISOString(),
          }))}
        />

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
                        <article className={`order-card ${order.status === "new" ? "order-card-new" : ""}`} key={order.id}>
                          <div className="order-card-top">
                            <div>
                              <span className="order-number">#{order.number}</span>
                              <strong>{order.tableName}</strong>
                            </div>
                            <span className="order-total">{formatMoney(order.total)}</span>
                          </div>

                          <div className="order-items-detailed">
                            {items.map((item) => (
                              <div className="order-item-detail" key={item.id}>
                                <strong>{item.quantity}× {item.productName}</strong>

                                {item.options.length > 0 && (
                                  <div className="order-item-options">
                                    {item.options.map((option, index) => (
                                      <span key={`${item.id}-option-${index}`}>
                                        + {option.name}
                                        {Number(option.price) > 0 ? ` (${formatMoney(option.price)})` : ""}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {item.note && <span className="order-item-note">Obs.: {item.note}</span>}
                              </div>
                            ))}
                          </div>

                          {order.note && <p className="order-note">Observação do pedido: {order.note}</p>}

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
