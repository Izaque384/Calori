import { db } from "@/db";
import DashboardSidebar from "@/components/dashboard-sidebar";
import TableFloorMap, { type FloorTableItem } from "@/components/table-floor-map";
import { orders, products, restaurantMembers, restaurants, serviceRequests, tables, tableVisits } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { and, asc, eq, gt, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSubscriptionSummary } from "@/lib/subscription";

export const dynamic = "force-dynamic";

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function priorityStatus(statuses: string[]) {
  if (statuses.includes("ready")) return "ready" as const;
  if (statuses.includes("preparing")) return "preparing" as const;
  if (statuses.includes("new")) return "new" as const;
  if (statuses.includes("delivered")) return "delivered" as const;
  return null;
}

export default async function DashboardPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const [membership] = await db.select({ restaurantId: restaurantMembers.restaurantId, role: restaurantMembers.role })
    .from(restaurantMembers).where(eq(restaurantMembers.userId, session.user.id)).limit(1);
  if (!membership) redirect("/onboarding");

  const [restaurant] = await db.select({
    id: restaurants.id,
    name: restaurants.name,
    slug: restaurants.slug,
    subscriptionStatus: restaurants.subscriptionStatus,
    trialEndsAt: restaurants.trialEndsAt,
  }).from(restaurants).where(and(eq(restaurants.id, membership.restaurantId), eq(restaurants.active, true))).limit(1);
  if (!restaurant) redirect("/onboarding");

  const subscription = getSubscriptionSummary({ status: restaurant.subscriptionStatus, trialEndsAt: restaurant.trialEndsAt });
  if (!subscription.hasAccess) redirect("/dashboard/assinatura?locked=1");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    todayRows, inProgressRows, activeTableRows, pendingServiceRows,
    productRows, tableRows, firstTableRows, lifetimeOrderRows,
    floorTableRows, floorVisits, floorOrders, floorRequests,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${orders.total}), 0)::text` })
      .from(orders).where(and(eq(orders.restaurantId, restaurant.id), gte(orders.createdAt, startOfDay), ne(orders.status, "cancelled"))),
    db.select({ count: sql<number>`count(*)::int` }).from(orders)
      .where(and(eq(orders.restaurantId, restaurant.id), inArray(orders.status, ["new", "preparing", "ready"]))),
    db.select({ count: sql<number>`count(*)::int` }).from(tableVisits)
      .where(and(eq(tableVisits.restaurantId, restaurant.id), isNull(tableVisits.closedAt), gt(tableVisits.expiresAt, new Date()))),
    db.select({ count: sql<number>`count(*)::int` }).from(serviceRequests)
      .where(and(eq(serviceRequests.restaurantId, restaurant.id), eq(serviceRequests.status, "pending"))),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(eq(products.restaurantId, restaurant.id)),
    db.select({ count: sql<number>`count(*)::int` }).from(tables).where(eq(tables.restaurantId, restaurant.id)),
    db.select({ id: tables.id }).from(tables).where(eq(tables.restaurantId, restaurant.id)).limit(1),
    db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.restaurantId, restaurant.id)),
    db.select({ id: tables.id, name: tables.name, publicCode: tables.publicCode, active: tables.active })
      .from(tables).where(eq(tables.restaurantId, restaurant.id)).orderBy(asc(tables.name)),
    db.select({ id: tableVisits.id, tableId: tableVisits.tableId, openedAt: tableVisits.openedAt }).from(tableVisits)
      .where(and(eq(tableVisits.restaurantId, restaurant.id), isNull(tableVisits.closedAt), gt(tableVisits.expiresAt, new Date()))),
    db.select({ tableId: orders.tableId, visitId: orders.visitId, status: orders.status, total: orders.total }).from(orders)
      .where(and(eq(orders.restaurantId, restaurant.id), ne(orders.status, "cancelled"))),
    db.select({ tableId: serviceRequests.tableId, type: serviceRequests.type }).from(serviceRequests)
      .where(and(eq(serviceRequests.restaurantId, restaurant.id), eq(serviceRequests.status, "pending"))),
  ]);

  const today = todayRows[0] ?? { count: 0, total: "0" };
  const inProgress = inProgressRows[0]?.count ?? 0;
  const activeTables = activeTableRows[0]?.count ?? 0;
  const pendingService = pendingServiceRows[0]?.count ?? 0;
  const productCount = productRows[0]?.count ?? 0;
  const tableCount = tableRows[0]?.count ?? 0;
  const firstTableId = firstTableRows[0]?.id;
  const lifetimeOrderCount = lifetimeOrderRows[0]?.count ?? 0;

  const activationSteps = [
    { done: productCount > 0, title: "Cadastre o primeiro produto", description: "Comece pelo item que melhor representa a casa.", href: "/dashboard/cardapio" },
    { done: tableCount > 0, title: "Crie a primeira mesa", description: "O QR Code será gerado automaticamente.", href: "/dashboard/mesas" },
    { done: lifetimeOrderCount > 0, title: "Teste o QR Code e o primeiro pedido", description: "Abra a primeira mesa como cliente e valide o fluxo completo antes de colocar no salão.", href: firstTableId ? `/dashboard/mesas/${firstTableId}/qr` : "/dashboard/mesas" },
  ];
  const activationComplete = activationSteps.every((step) => step.done);

  const floorData: FloorTableItem[] = floorTableRows.map((table) => {
    const visit = floorVisits.find((item) => item.tableId === table.id) ?? null;
    const tableOrders = visit ? floorOrders.filter((item) => item.visitId === visit.id) : [];
    const requests = floorRequests.filter((item) => item.tableId === table.id);
    return {
      ...table,
      occupied: Boolean(visit),
      startedAt: visit?.openedAt.toISOString() ?? null,
      orderCount: tableOrders.length,
      total: tableOrders.reduce((sum, item) => sum + Number(item.total), 0),
      orderStatus: priorityStatus(tableOrders.map((item) => item.status)),
      waiterRequest: requests.some((item) => item.type === "call_waiter"),
      billRequest: requests.some((item) => item.type === "request_bill"),
      pendingCount: requests.length,
    };
  });

  const attentionCount = floorData.filter((table) => table.waiterRequest || table.billRequest || table.orderStatus === "ready").length;

  return (
    <main className="dashboard-shell">
      <DashboardSidebar restaurantName={restaurant.name} role={membership.role} activePath="/dashboard" />
      <section className="dashboard-content">
        <div className="dashboard-live-heading">
          <div>
            <p className="eyebrow">Salão agora</p>
            <h1>Veja a operação acontecendo.</h1>
            <p className="muted">Mesas, pedidos e chamados organizados em uma visão que acompanha o ritmo real do restaurante.</p>
          </div>
          <div className="dashboard-live-summary">
            <span><strong>{activeTables}</strong> ocupadas</span>
            <span><strong>{inProgress}</strong> pedidos ativos</span>
            <span className={attentionCount ? "needs-attention" : ""}><strong>{attentionCount}</strong> precisam de atenção</span>
          </div>
        </div>

        {membership.role === "owner" && restaurant.subscriptionStatus === "trialing" && (
          <a href="/dashboard/assinatura" className="trial-banner">
            <div>
              <span className="section-kicker">Período gratuito</span>
              <strong>{subscription.trialDaysRemaining > 0 ? `${subscription.trialDaysRemaining} ${subscription.trialDaysRemaining === 1 ? "dia restante" : "dias restantes"}` : "Trial encerrado"}</strong>
            </div>
            <span>Ver assinatura →</span>
          </a>
        )}

        {membership.role !== "staff" && !activationComplete && (
          <section className="activation-card">
            <div className="activation-card-heading">
              <div><span className="section-kicker">Primeiros passos</span><h2>Prepare o Calori para o primeiro atendimento.</h2></div>
              <span>{activationSteps.filter((step) => step.done).length}/3 concluídos</span>
            </div>
            <div className="activation-steps">
              {activationSteps.map((step, index) => (
                <a className={step.done ? "done" : ""} href={step.href} key={step.title}>
                  <span>{step.done ? "✓" : index + 1}</span>
                  <div><strong>{step.title}</strong><small>{step.description}</small></div>
                  <b>→</b>
                </a>
              ))}
            </div>
          </section>
        )}

        <TableFloorMap tables={floorData} restaurantSlug={restaurant.slug} />

        <div className="dashboard-section-heading">
          <div><span className="section-kicker">Hoje</span><h2>Resumo da operação</h2></div>
          {membership.role !== "staff" && <a href="/dashboard/relatorios">Ver relatórios →</a>}
        </div>

        <div className="metric-grid">
          <article><span>Pedidos hoje</span><strong>{today.count}</strong></article>
          <article><span>Em andamento</span><strong>{inProgress}</strong></article>
          <article><span>Mesas ocupadas</span><strong>{activeTables}</strong></article>
          <article><span>Total em pedidos</span><strong>{formatMoney(today.total)}</strong></article>
        </div>

        <div className="dashboard-quick-actions">
          <a href="/dashboard/pedidos"><span>Operação</span><strong>Pedidos</strong><small>Do novo pedido à entrega →</small></a>
          <a href="/dashboard/atendimento"><span>Prioridade</span><strong>Atendimento</strong><small>{pendingService} pendentes agora →</small></a>
          {membership.role !== "staff" && <a href="/dashboard/cardapio"><span>Cardápio</span><strong>Cardápio</strong><small>Produtos, preços e personalizações →</small></a>}
          <a href="/dashboard/mesas"><span>Salão</span><strong>Mesas</strong><small>Configuração e QR Codes →</small></a>
        </div>
      </section>
    </main>
  );
}
