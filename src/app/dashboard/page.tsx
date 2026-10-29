import Link from "next/link";
import { db } from "@/db";
import DashboardSidebar from "@/components/dashboard-sidebar";
import DashboardOverviewMonitor from "@/components/dashboard-overview-monitor";
import { orders, products, serviceRequests, tables, tableVisits } from "@/db/schema";
import { and, asc, desc, eq, gt, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";

export const dynamic = "force-dynamic";

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function orderStatusLabel(status: string) {
  if (status === "new") return "Novo";
  if (status === "preparing") return "Preparando";
  if (status === "ready") return "Pronto";
  return "Em andamento";
}

function requestLabel(type: string) {
  return type === "request_bill" ? "Conta solicitada" : "Atendimento";
}

export default async function DashboardPage() {
  const { restaurant, role, subscription } = await requireCurrentRestaurant();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    todayRows,
    inProgressRows,
    activeTableRows,
    pendingServiceRows,
    productRows,
    tableRows,
    firstTableRows,
    lifetimeOrderRows,
    activeOrders,
    pendingRequests,
  ] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${orders.total}), 0)::text`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.restaurantId, restaurant.id),
          gte(orders.createdAt, startOfDay),
          ne(orders.status, "cancelled"),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.restaurantId, restaurant.id),
          inArray(orders.status, ["new", "preparing", "ready"]),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tableVisits)
      .where(
        and(
          eq(tableVisits.restaurantId, restaurant.id),
          isNull(tableVisits.closedAt),
          gt(tableVisits.expiresAt, new Date()),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.restaurantId, restaurant.id),
          eq(serviceRequests.status, "pending"),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.restaurantId, restaurant.id)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tables)
      .where(eq(tables.restaurantId, restaurant.id)),
    db
      .select({ id: tables.id })
      .from(tables)
      .where(eq(tables.restaurantId, restaurant.id))
      .limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.restaurantId, restaurant.id)),
    db
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        total: orders.total,
        createdAt: orders.createdAt,
        tableName: tables.name,
      })
      .from(orders)
      .innerJoin(tables, eq(orders.tableId, tables.id))
      .where(
        and(
          eq(orders.restaurantId, restaurant.id),
          inArray(orders.status, ["new", "preparing", "ready"]),
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(6),
    db
      .select({
        id: serviceRequests.id,
        type: serviceRequests.type,
        note: serviceRequests.note,
        createdAt: serviceRequests.createdAt,
        tableName: tables.name,
      })
      .from(serviceRequests)
      .innerJoin(tables, eq(serviceRequests.tableId, tables.id))
      .where(
        and(
          eq(serviceRequests.restaurantId, restaurant.id),
          eq(serviceRequests.status, "pending"),
        ),
      )
      .orderBy(asc(serviceRequests.createdAt))
      .limit(6),
  ]);

  const today = todayRows[0] ?? { count: 0, total: "0" };
  const inProgress = inProgressRows[0]?.count ?? 0;
  const activeTables = activeTableRows[0]?.count ?? 0;
  const pendingService = pendingServiceRows[0]?.count ?? 0;
  const productCount = productRows[0]?.count ?? 0;
  const tableCount = tableRows[0]?.count ?? 0;
  const firstTableId = firstTableRows[0]?.id;
  const lifetimeOrderCount = lifetimeOrderRows[0]?.count ?? 0;
  const readyOrders = activeOrders.filter((order) => order.status === "ready");
  const attentionCount = pendingRequests.length + readyOrders.length;

  const activationSteps = [
    { done: productCount > 0, title: "Cadastre o primeiro produto", href: "/dashboard/cardapio" },
    { done: tableCount > 0, title: "Crie a primeira mesa", href: "/dashboard/mesas" },
    {
      done: lifetimeOrderCount > 0,
      title: "Teste o primeiro pedido",
      href: firstTableId ? `/dashboard/mesas/${firstTableId}/qr` : "/dashboard/mesas",
    },
  ];
  const activationComplete = activationSteps.every((step) => step.done);

  const quickActions = [
    {
      href: "/dashboard/pedidos",
      label: "Pedidos",
      description: "Acompanhar preparo e entrega",
      value: inProgress ? `${inProgress} ativos` : "Fila limpa",
    },
    {
      href: "/dashboard/mesas",
      label: "Mesas",
      description: "Ocupação, consumo e QR Codes",
      value: `${activeTables} ocupadas`,
    },
    {
      href: "/dashboard/atendimento",
      label: "Atendimento",
      description: "Chamados e solicitações de conta",
      value: pendingService ? `${pendingService} pendentes` : "Sem chamados",
    },
  ];

  if (role !== "staff") {
    quickActions.push({
      href: "/dashboard/cardapio",
      label: "Cardápio",
      description: "Produtos, categorias e disponibilidade",
      value: `${productCount} produtos`,
    });
  }

  return (
    <main className="dashboard-shell">
      <DashboardSidebar restaurantName={restaurant.name} role={role} activePath="/dashboard" />

      <section className="dashboard-content dashboard-overview-content">
        <header className="overview-header">
          <div>
            <p className="eyebrow">Visão geral</p>
            <h1>Operação de hoje.</h1>
            <p className="muted">
              Acompanhe pedidos, salão e atendimento sem sair do essencial.
            </p>
          </div>
          <DashboardOverviewMonitor />
        </header>

        {role === "owner" && restaurant.subscriptionStatus === "trialing" && (
          <Link href="/dashboard/assinatura" className="overview-trial-banner">
            <div>
              <span>Período gratuito</span>
              <strong>
                {subscription.trialDaysRemaining > 0
                  ? `${subscription.trialDaysRemaining} ${subscription.trialDaysRemaining === 1 ? "dia restante" : "dias restantes"}`
                  : "Trial encerrado"}
              </strong>
            </div>
            <span>Ver assinatura →</span>
          </Link>
        )}

        <section className="overview-metric-grid" aria-label="Indicadores de hoje">
          <article className="overview-metric-card">
            <span>Vendas hoje</span>
            <strong>{formatMoney(today.total)}</strong>
            <small>{today.count} {today.count === 1 ? "pedido registrado" : "pedidos registrados"}</small>
          </article>
          <article className="overview-metric-card">
            <span>Pedidos em andamento</span>
            <strong>{inProgress}</strong>
            <small>{readyOrders.length ? `${readyOrders.length} prontos para sair` : "Nenhum pedido pronto agora"}</small>
          </article>
          <article className="overview-metric-card">
            <span>Mesas ocupadas</span>
            <strong>{activeTables}</strong>
            <small>{tableCount ? `de ${tableCount} mesas cadastradas` : "Nenhuma mesa cadastrada"}</small>
          </article>
          <article className={`overview-metric-card ${pendingService ? "attention" : ""}`}>
            <span>Atendimento</span>
            <strong>{pendingService}</strong>
            <small>{pendingService ? "solicitações aguardando" : "Tudo em dia no salão"}</small>
          </article>
        </section>

        <div className="overview-main-grid">
          <section className="overview-panel overview-priorities">
            <div className="overview-panel-heading">
              <div>
                <span className="section-kicker">Prioridades</span>
                <h2>O que precisa de atenção agora</h2>
              </div>
              <span className={attentionCount ? "overview-count attention" : "overview-count"}>
                {attentionCount}
              </span>
            </div>

            {pendingRequests.length === 0 && readyOrders.length === 0 ? (
              <div className="overview-empty">
                <span className="overview-empty-mark">✓</span>
                <div>
                  <strong>Nada urgente neste momento.</strong>
                  <p>Novos chamados e pedidos prontos aparecem aqui automaticamente.</p>
                </div>
              </div>
            ) : (
              <div className="overview-priority-list">
                {pendingRequests.map((request) => (
                  <Link href="/dashboard/atendimento" className="overview-priority-row" key={request.id}>
                    <span className={`overview-priority-icon ${request.type}`} aria-hidden="true" />
                    <div>
                      <strong>{request.tableName}</strong>
                      <span>{requestLabel(request.type)}</span>
                      {request.note && <small>{request.note}</small>}
                    </div>
                    <time>
                      {request.createdAt.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </Link>
                ))}

                {readyOrders.map((order) => (
                  <Link href="/dashboard/pedidos" className="overview-priority-row" key={order.id}>
                    <span className="overview-priority-icon ready" aria-hidden="true" />
                    <div>
                      <strong>{order.tableName}</strong>
                      <span>Pedido #{order.number} pronto</span>
                    </div>
                    <strong className="overview-row-value">{formatMoney(order.total)}</strong>
                  </Link>
                ))}
              </div>
            )}

            <div className="overview-panel-footer">
              <Link href="/dashboard/atendimento">Abrir atendimento</Link>
              <Link href="/dashboard/pedidos">Abrir pedidos</Link>
            </div>
          </section>

          <section className="overview-panel">
            <div className="overview-panel-heading">
              <div>
                <span className="section-kicker">Acesso rápido</span>
                <h2>Ir direto ao trabalho</h2>
              </div>
            </div>

            <div className="overview-quick-actions">
              {quickActions.map((action) => (
                <Link href={action.href} key={action.href}>
                  <span>{action.value}</span>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                  <i aria-hidden="true">→</i>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <section className="overview-panel overview-orders-panel">
          <div className="overview-panel-heading">
            <div>
              <span className="section-kicker">Pedidos</span>
              <h2>Em andamento</h2>
            </div>
            <Link className="overview-heading-link" href="/dashboard/pedidos">Ver todos →</Link>
          </div>

          {activeOrders.length === 0 ? (
            <div className="overview-empty compact">
              <span className="overview-empty-mark">✓</span>
              <div>
                <strong>Nenhum pedido em andamento.</strong>
                <p>Os próximos pedidos aparecerão aqui assim que forem enviados.</p>
              </div>
            </div>
          ) : (
            <div className="overview-order-list">
              {activeOrders.map((order) => (
                <Link href="/dashboard/pedidos" className="overview-order-row" key={order.id}>
                  <div className="overview-order-number">
                    <span>Pedido</span>
                    <strong>#{order.number}</strong>
                  </div>
                  <div className="overview-order-table">
                    <strong>{order.tableName}</strong>
                    <time>
                      {order.createdAt.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <span className={`overview-order-status ${order.status}`}>
                    {orderStatusLabel(order.status)}
                  </span>
                  <strong className="overview-order-total">{formatMoney(order.total)}</strong>
                </Link>
              ))}
            </div>
          )}
        </section>

        {role !== "staff" && !activationComplete && (
          <section className="overview-panel overview-setup-panel">
            <div className="overview-panel-heading">
              <div>
                <span className="section-kicker">Configuração inicial</span>
                <h2>Deixe o restaurante pronto para operar</h2>
              </div>
              <span className="overview-count">
                {activationSteps.filter((step) => step.done).length}/3
              </span>
            </div>

            <div className="overview-setup-list">
              {activationSteps.map((step, index) => (
                <Link className={step.done ? "done" : ""} href={step.href} key={step.title}>
                  <i>{step.done ? "✓" : index + 1}</i>
                  <span>{step.title}</span>
                  <b aria-hidden="true">→</b>
                </Link>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
