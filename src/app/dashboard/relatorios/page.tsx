import { db } from "@/db";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { orderItems, orders } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { canViewReports } from "@/lib/permissions";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

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

type Props = {
  searchParams: Promise<{ period?: string }>;
};

function resolvePeriod(value: string | undefined) {
  return value === "7" || value === "90" ? Number(value) : 30;
}

export default async function ReportsPage({ searchParams }: Props) {
  const { period: periodParam } = await searchParams;
  const period = resolvePeriod(periodParam);
  const { restaurant, role } = await requireCurrentRestaurant();
  if (!canViewReports(role)) redirect("/dashboard/pedidos");

  const start7 = startOfDaysAgo(6);
  const startPeriod = startOfDaysAgo(period - 1);

  const [summaryRows, recentOrders, topProducts] = await Promise.all([
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
          gte(orders.createdAt, startPeriod),
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
          gte(orders.createdAt, startPeriod),
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
          gte(orders.createdAt, startPeriod),
          ne(orders.status, "cancelled"),
        ),
      )
      .groupBy(orderItems.productName)
      .orderBy(desc(sql`sum(${orderItems.quantity})`))
      .limit(8),
  ]);

  const summary = summaryRows[0] ?? { count: 0, total: "0", average: "0" };
  const dailyAverage = Number(summary.total) / period;

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
      <DashboardSidebar restaurantName={restaurant.name} role={role} activePath="/dashboard/relatorios" />

      <section className="dashboard-content reports-content">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Gestão</p>
            <h1>Entenda o ritmo do restaurante.</h1>
            <p className="muted">Transforme a rotina do salão em sinais simples para decidir melhor. Os valores abaixo representam pedidos registrados, não pagamentos recebidos.</p>
          </div>
        </div>

        <div className="reports-toolbar">
          <nav className="report-period-tabs" aria-label="Período do relatório">
            {[7, 30, 90].map((days) => (
              <a
                className={period === days ? "active" : ""}
                href={`/dashboard/relatorios?period=${days}`}
                key={days}
              >
                {days} dias
              </a>
            ))}
          </nav>
          <a
            className="secondary-link-button reports-export-button"
            href={`/api/dashboard/reports.csv?period=${period}`}
          >
            Exportar CSV
          </a>
        </div>

        <div className="metric-grid reports-metrics">
          <article><span>Pedidos · {period} dias</span><strong>{summary.count}</strong></article>
          <article><span>Volume · {period} dias</span><strong>{formatMoney(summary.total)}</strong></article>
          <article><span>Ticket médio · {period} dias</span><strong>{formatMoney(summary.average)}</strong></article>
          <article><span>Média diária · {period} dias</span><strong>{formatMoney(dailyAverage)}</strong></article>
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
              <span className="section-kicker">Últimos {period} dias</span>
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
