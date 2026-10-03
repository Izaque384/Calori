import { db } from "@/db";
import { restaurantMembers, restaurants } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

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

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand">Calori<span>.</span></div>
        <div className="restaurant-pill">{restaurant.name}</div>
        <nav>
          <a className="active" href="/dashboard">Visão geral</a>
          <span>Pedidos</span><a href="/dashboard/cardapio">Cardápio</a><span>Mesas</span><span>Configurações</span>
        </nav>
        <form action={signOut}><button className="ghost-button" type="submit">Sair</button></form>
      </aside>
      <section className="dashboard-content">
        <p className="eyebrow">Visão geral</p>
        <h1>Olá, {session.user.name?.split(" ")[0] || "bem-vindo"}.</h1>
        <p className="muted">Seu restaurante já está conectado à Calori. Agora podemos construir cardápio, mesas e pedidos.</p>
        <div className="metric-grid">
          <article><span>Pedidos hoje</span><strong>0</strong></article>
          <article><span>Em andamento</span><strong>0</strong></article>
          <article><span>Mesas ativas</span><strong>0</strong></article>
          <article><span>Total em pedidos</span><strong>R$ 0,00</strong></article>
        </div>
      </section>
    </main>
  );
}
