import { db } from "@/db";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { orders, restaurantMembers, restaurants, serviceRequests, tableSessions } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { and, eq, gt, gte, inArray, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSubscriptionSummary } from "@/lib/subscription";

export const dynamic = "force-dynamic";

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

export default async function DashboardPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const [membership] = await db
    .select({ restaurantId: restaurantMembers.restaurantId, role: restaurantMembers.role })
    .from(restaurantMembers)
    .where(eq(restaurantMembers.userId, session.user.id))
    .limit(1);

  if (!membership) redirect("/onboarding");

  const [restaurant] = await db
    .select({
      id: restaurants.id,
      name: restaurants.name,
      slug: restaurants.slug,
      subscriptionStatus: restaurants.subscriptionStatus,
      trialEndsAt: restaurants.trialEndsAt,
    })
    .from(restaurants)
    .where(and(eq(restaurants.id, membership.restaurantId), eq(restaurants.active, true)))
    .limit(1);

  if (!restaurant) redirect("/onboarding");

  const subscription = getSubscriptionSummary({
    status: restaurant.subscriptionStatus,
    trialEndsAt: restaurant.trialEndsAt,
  });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todayRows, inProgressRows, activeTableRows, pendingServiceRows] = await Promise.all([
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
      .select({ count: sql<number>`count(distinct ${tableSessions.tableId})::int` })
      .from(tableSessions)
      .where(
        and(
          eq(tableSessions.restaurantId, restaurant.id),
          gt(tableSessions.expiresAt, new Date()),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(serviceRequests)
      .where(and(eq(serviceRequests.restaurantId, restaurant.id), eq(serviceRequests.status, "pending"))),
  ]);

  const today = todayRows[0] ?? { count: 0, total: "0" };
  const inProgress = inProgressRows[0]?.count ?? 0;
  const activeTables = activeTableRows[0]?.count ?? 0;
  const pendingService = pendingServiceRows[0]?.count ?? 0;

  return (
    <main className="dashboard-shell">
      <DashboardSidebar restaurantName={restaurant.name} role={membership.role} activePath="/dashboard" />
      <section className="dashboard-content">
        <p className="eyebrow">Hoje no salão</p>
        <h1>Tudo pronto para um bom serviço.</h1>
        <p className="muted">Pedidos, mesas e atendimento organizados para sua equipe focar no que realmente importa: a experiência à mesa.</p>
        {membership.role === "owner" && restaurant.subscriptionStatus === "trialing" && (
          <a href="/dashboard/assinatura" className="trial-banner">
            <div>
              <span className="section-kicker">Período gratuito</span>
              <strong>
                {subscription.trialDaysRemaining > 0
                  ? `${subscription.trialDaysRemaining} ${subscription.trialDaysRemaining === 1 ? "dia restante" : "dias restantes"}`
                  : "Trial encerrado"}
              </strong>
            </div>
            <span>Ver assinatura →</span>
          </a>
        )}
        <div className="dashboard-quick-actions">
          <a href="/dashboard/pedidos">
            <span>Operação</span>
            <strong>Pedidos</strong>
            <small>Do novo pedido à entrega →</small>
          </a>
          <a href="/dashboard/atendimento">
            <span>Salão</span>
            <strong>Atendimento</strong>
            <small>Chamados e contas no tempo certo →</small>
          </a>
          {membership.role !== "staff" && (
            <a href="/dashboard/cardapio">
              <span>Cardápio</span>
              <strong>Cardápio</strong>
              <small>Produtos, preços e personalizações →</small>
            </a>
          )}
          <a href="/dashboard/mesas">
            <span>Mesas</span>
            <strong>Mesas</strong>
            <small>O salão inteiro em um olhar →</small>
          </a>
        </div>

        <div className="dashboard-section-heading">
          <div>
            <span className="section-kicker">Hoje</span>
            <h2>Resumo da operação</h2>
          </div>
          {membership.role !== "staff" && (
            <a href="/dashboard/relatorios">Ver relatórios →</a>
          )}
        </div>

        <div className="metric-grid">
          <article><span>Pedidos hoje</span><strong>{today.count}</strong></article>
          <article><span>Em andamento</span><strong>{inProgress}</strong></article>
          <article><span>Mesas ocupadas</span><strong>{activeTables}</strong></article>
          <article><span>Total em pedidos</span><strong>{formatMoney(today.total)}</strong></article>
        </div>
        <a href="/dashboard/atendimento" className="service-summary-card">
          <div>
            <span className="section-kicker">Atendimento agora</span>
            <strong>{pendingService} {pendingService === 1 ? "solicitação pendente" : "solicitações pendentes"}</strong>
          </div>
          <span>Ver atendimento →</span>
        </a>
      </section>
    </main>
  );
}
