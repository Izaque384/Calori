import { db } from "@/db";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { type FloorTableItem } from "@/components/table-floor-map";
import RestaurantOperationsScene, { type SceneStaffItem } from "@/components/restaurant-operations-scene";
import { orders, products, restaurantMembers, restaurants, serviceRequests, tables, tableVisits } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { and, asc, eq, gt, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSubscriptionSummary } from "@/lib/subscription";

export const dynamic = "force-dynamic";

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
    floorTableRows, floorVisits, floorOrders, floorRequests, floorStaff,
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
    db.select({
      userId: restaurantMembers.userId,
      role: restaurantMembers.role,
      displayName: restaurantMembers.displayName,
      email: restaurantMembers.email,
      workArea: restaurantMembers.workArea,
    }).from(restaurantMembers)
      .where(eq(restaurantMembers.restaurantId, restaurant.id))
      .orderBy(asc(restaurantMembers.createdAt)),
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
    { done: productCount > 0, title: "Cadastre o primeiro produto", href: "/dashboard/cardapio" },
    { done: tableCount > 0, title: "Crie a primeira mesa", href: "/dashboard/mesas" },
    { done: lifetimeOrderCount > 0, title: "Teste o primeiro pedido", href: firstTableId ? `/dashboard/mesas/${firstTableId}/qr` : "/dashboard/mesas" },
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

  const sceneStaff: SceneStaffItem[] = floorStaff.map((member) => ({
    id: member.userId,
    name: member.displayName?.trim()
      || member.email?.split("@")[0]
      || (member.role === "owner" ? "Responsável" : "Equipe"),
    role: member.role,
    workArea: member.workArea === "waiter" || member.workArea === "kitchen"
      ? member.workArea
      : null,
  }));

  return (
    <main className="dashboard-shell dashboard-shell-cinematic">
      <DashboardSidebar restaurantName={restaurant.name} role={membership.role} activePath="/dashboard" />

      <section className="dashboard-content dashboard-isometric-content dashboard-cinematic-content">
        <RestaurantOperationsScene
          tables={floorData}
          staff={sceneStaff}
          restaurantName={restaurant.name}
          restaurantSlug={restaurant.slug}
          canViewReports={membership.role !== "staff"}
          metrics={{
            activeTables,
            activeOrders: inProgress,
            pendingService,
            attentionCount,
            todayOrders: today.count,
            todayTotal: Number(today.total),
          }}
        />

        {membership.role === "owner" && restaurant.subscriptionStatus === "trialing" && (
          <a href="/dashboard/assinatura" className="cinematic-trial-chip glass-panel">
            <span>Período gratuito</span>
            <strong>
              {subscription.trialDaysRemaining > 0
                ? `${subscription.trialDaysRemaining} ${subscription.trialDaysRemaining === 1 ? "dia restante" : "dias restantes"}`
                : "Trial encerrado"}
            </strong>
          </a>
        )}

        {membership.role !== "staff" && !activationComplete && (
          <aside className="cinematic-setup-card glass-panel">
            <div>
              <span>Configuração inicial</span>
              <strong>{activationSteps.filter((step) => step.done).length}/3 concluídos</strong>
            </div>
            <nav aria-label="Etapas de configuração">
              {activationSteps.map((step, index) => (
                <a className={step.done ? "done" : ""} href={step.href} key={step.title}>
                  <i>{step.done ? "✓" : index + 1}</i>
                  <span>{step.title}</span>
                </a>
              ))}
            </nav>
          </aside>
        )}
      </section>
    </main>
  );
}
