import { db } from "@/db";
import { orders, restaurantMembers, restaurants, serviceRequests, tables } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { signOut } from "./actions";

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
    .select({ restaurantId: restaurantMembers.restaurantId })
    .from(restaurantMembers)
    .where(eq(restaurantMembers.userId, session.user.id))
    .limit(1);

  if (!membership) redirect("/onboarding");

  const [restaurant] = await db
    .select({ id: restaurants.id, name: restaurants.name, slug: restaurants.slug })
    .from(restaurants)
    .where(and(eq(restaurants.id, membership.restaurantId), eq(restaurants.active, true)))
    .limit(1);

  if (!restaurant) redirect("/onboarding");

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
      .from(tables)
      .where(and(eq(tables.restaurantId, restaurant.id), eq(tables.active, true))),
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
      <aside className="dashboard-sidebar">
        <div className="brand">Calori<span>.</span></div>
        <div className="restaurant-pill">{restaurant.name}</div>
        <nav>
          <a className="active" href="/dashboard">Visão geral</a>
          <a href="/dashboard/pedidos">Pedidos</a>
          <a href="/dashboard/cardapio">Cardápio</a>
          <a href="/dashboard/mesas">Mesas</a>
          <a href="/dashboard/atendimento">Atendimento</a>
          <span>Configurações</span>
        </nav>
        <form action={signOut}><button className="ghost-button" type="submit">Sair</button></form>
      </aside>
      <section className="dashboard-content">
        <p className="eyebrow">Visão geral</p>
        <h1>Olá, {session.user.name?.split(" ")[0] || "bem-vindo"}.</h1>
        <p className="muted">Acompanhe os principais números do restaurante e acesse rapidamente a operação.</p>
        <div className="metric-grid">
          <article><span>Pedidos hoje</span><strong>{today.count}</strong></article>
          <article><span>Em andamento</span><strong>{inProgress}</strong></article>
          <article><span>Mesas ativas</span><strong>{activeTables}</strong></article>
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
