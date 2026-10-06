import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { canViewReports } from "@/lib/permissions";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { signOut } from "../actions";

export const dynamic = "force-dynamic";

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function startOfDaysAgo(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

export default async function ReportsPage() {
  const { restaurant, role } = await requireCurrentRestaurant();
  if (!canViewReports(role)) redirect("/dashboard/pedidos");

  const start7 = startOfDaysAgo(6);
  const start30 = startOfDaysAgo(29);

  const [summary7Rows, summary30Rows, recentOrders, topProducts] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${orders.total}), 0)::text`,
        average: sql<string>`coalesce(avg(${orders.total}), 0)::text`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.restaurantId, restaurant.id),
          gte(orders.createdAt, start7),
          ne(orders.status, "cancelled"),
        ),
      ),
    db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${orders.total}), 0)::text`,
        average: sql<string>`coalesce(avg(${orders.total}), 0)::text`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.restaurantId, restaurant.id),
          gte(orders.createdAt, start30),
          ne(orders.status, "cancelled"),
        ),
      ),
    db
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        total: orders.total,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(
        and(
          eq(orders.restaurantId, restaurant.id),
          gte(orders.createdAt, start30),
          ne(orders.status, "cancelled"),
        ),
      )
      .orderBy(desc(orders.createdAt)),
    db
      .select({
        productName: orderItems.productName,
        quantity: sql<number>`sum(${orderItems.quantity})::int`,
        total: sql<string>`coalesce(sum(${orderItems.subtotal}), 0)::text`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orders.restaurantId, restaurant.id),
          gte(orders.createdAt, start30),
          ne(orders.status, "cancelled"),
        ),
      )
      .groupBy(orderItems.productName)
      .orderBy(desc(sql`sum(${orderItems.quantity})`))
      .limit(8),
  ]);

  const summary7 = summary7Rows[0] ?? { count: 0, total: "0", average: "0" };
  const summary30 = summary30Rows[0] ?? { count: 0, total: "0", average: "0" };

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start7);
    date.setDate(start7.getDate() + index);
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
      total: 0,
      count: 0,
    };
  });

  for (const order of recentOrders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const day = days.find((item) => item.key === key);
    if (!day) continue;
    day.total += Number(order.total);
    day.count += 1;
  }

  const maxDayTotal = Math.max(...days.map((day) => day.total), 1);

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand">Calori<span>.</span></div>
        <div className="restaurant-pill">{restaurant.name}</div>
        <nav>
          <a href="/dashboard">Visão geral</a>
          <a href="/dashboard/pedidos">Pedidos</a>
          <a href="/dashboard/cardapio">Cardápio</a>
          <a href="/dashboard/mesas">Mesas</a>
          <a href="/dashboard/atendimento">Atendimento</a>
          <a className="active" href="/dashboard/relatorios">Relatórios</a>
          {role === "owner" && <a href="/dashboard/equipe">Equipe</a>}
          {role === "owner" && <a href="/dashboard/configuracoes">Configurações</a>}
        </nav>
        <form action={signOut}><button className="ghost-button" type="submit">Sair</button></form>
      </aside>

      <section className="dashboard-content reports-content">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Relatórios</p>
            <h1>Desempenho do restaurante.</h1>
            <p className="muted">Acompanhe volume em pedidos e itens mais vendidos. Valores representam pedidos registrados, não pagamentos recebidos.</p>
          </div>
        </div>

        <div className="metric-grid reports-metrics">
          <article><span>Pedidos · 7 dias</span><strong>{summary7.count}</strong></article>
          <article><span>Volume · 7 dias</span><strong>{formatMoney(summary7.total)}</strong></article>
          <article><span>Ticket médio · 30 dias</span><strong>{formatMoney(summary30.average)}</strong></article>
          <article><span>Volume · 30 dias</span><strong>{formatMoney(summary30.total)}</strong></article>
        </div>

        <section className="reports-card">
          <div className="section-title">
            <div>
              <span className="section-kicker">Últimos 7 dias</span>
              <h2>Volume diário</h2>
            </div>
          </div>

          <div className="daily-bars">
            {days.map((day) => (
              <div className="daily-bar-column" key={day.key}>
                <div className="daily-bar-value">{formatMoney(day.total)}</div>
                <div className="daily-bar-track">
                  <div
                    className="daily-bar-fill"
                    style={{ height: `${Math.max(6, (day.total / maxDayTotal) * 100)}%` }}
                  />
                </div>
                <strong>{day.label}</strong>
                <span>{day.count} {day.count === 1 ? "pedido" : "pedidos"}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="reports-card">
          <div className="section-title">
            <div>
              <span className="section-kicker">Últimos 30 dias</span>
              <h2>Itens mais vendidos</h2>
            </div>
          </div>

          {topProducts.length === 0 ? (
            <div className="large-empty-state">
              <strong>Ainda não há dados suficientes.</strong>
              <span>Os itens mais vendidos aparecerão aqui conforme os pedidos forem registrados.</span>
            </div>
          ) : (
            <div className="top-products-list">
              {topProducts.map((product, index) => (
                <div className="top-product-row" key={product.productName}>
                  <span className="ranking-number">{index + 1}</span>
                  <div>
                    <strong>{product.productName}</strong>
                    <span>{product.quantity} unidades</span>
                  </div>
                  <strong>{formatMoney(product.total)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
