import { db } from "@/db";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { orders, products, restaurantMembers, restaurants, serviceRequests, tables, tableVisits } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { and, eq, gt, gte, inArray, isNull, ne, sql } from "drizzle-orm";
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

  if (!subscription.hasAccess) {
    redirect("/dashboard/assinatura?locked=1");
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todayRows, inProgressRows, activeTableRows, pendingServiceRows, productRows, tableRows, lifetimeOrderRows] = await Promise.all([
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
      .where(and(eq(serviceRequests.restaurantId, restaurant.id), eq(serviceRequests.status, "pending"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.restaurantId, restaurant.id)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tables)
      .where(eq(tables.restaurantId, restaurant.id)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.restaurantId, restaurant.id)),
  ]);

  const today = todayRows[0] ?? { count: 0, total: "0" };
  const inProgress = inProgressRows[0]?.count ?? 0;
  const activeTables = activeTableRows[0]?.count ?? 0;
  const pendingService = pendingServiceRows[0]?.count ?? 0;
  const productCount = productRows[0]?.count ?? 0;
  const tableCount = tableRows[0]?.count ?? 0;
  const lifetimeOrderCount = lifetimeOrderRows[0]?.count ?? 0;
  const activationSteps = [
    {
      done: productCount > 0,
      title: "Cadastre o primeiro produto",
      description: "Comece pelo item que melhor representa a casa.",
      href: "/dashboard/cardapio",
    },
    {
      done: tableCount > 0,
      title: "Crie a primeira mesa",
      description: "O QR Code será gerado automaticamente.",
      href: "/dashboard/mesas",
    },
    {
      done: lifetimeOrderCount > 0,
      title: "Faça um pedido teste",
      description: "Valide a experiência do cliente antes de colocar no salão.",
      href: "/dashboard/mesas",
    },
  ];
  const activationComplete = activationSteps.every((step) => step.done);

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
        {membership.role !== "staff" && !activationComplete && (
          <section className="activation-card">
            <div className="activation-card-heading">
              <div>
                <span className="section-kicker">Primeiros passos</span>
                <h2>Prepare o Calori para o primeiro atendimento.</h2>
              </div>
              <span>{activationSteps.filter((step) => step.done).length}/3 concluídos</span>
            </div>
            <div className="activation-steps">
              {activationSteps.map((step, index) => (
                <a className={step.done ? "done" : ""} href={step.href} key={step.title}>
                  <span>{step.done ? "✓" : index + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <small>{step.description}</small>
                  </div>
                  <b>→</b>
                </a>
              ))}
            </div>
          </section>
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
