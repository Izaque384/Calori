import { db } from "@/db";
import { orders, restaurantMembers, restaurants, tableVisits } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { getSubscriptionSummary } from "@/lib/subscription";
import { and, eq, isNull, sql } from "drizzle-orm";

export async function GET() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const [membership] = await db
    .select({ restaurantId: restaurantMembers.restaurantId })
    .from(restaurantMembers)
    .where(eq(restaurantMembers.userId, session.user.id))
    .limit(1);

  if (!membership) {
    return Response.json({ error: "Restaurante não encontrado." }, { status: 404 });
  }

  const [restaurant] = await db
    .select({
      active: restaurants.active,
      subscriptionStatus: restaurants.subscriptionStatus,
      trialEndsAt: restaurants.trialEndsAt,
    })
    .from(restaurants)
    .where(eq(restaurants.id, membership.restaurantId))
    .limit(1);

  const access = restaurant
    ? getSubscriptionSummary({
        status: restaurant.subscriptionStatus,
        trialEndsAt: restaurant.trialEndsAt,
      })
    : null;

  if (!restaurant?.active || !access?.hasAccess) {
    return Response.json({ error: "Assinatura inativa." }, { status: 402 });
  }

  const rows = await db
    .select({
      id: tableVisits.id,
      tableId: tableVisits.tableId,
      openedAt: tableVisits.openedAt,
      orderCount: sql<number>`count(${orders.id}) filter (where ${orders.status} <> 'cancelled')::int`,
      total: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} <> 'cancelled'), 0)::text`,
    })
    .from(tableVisits)
    .leftJoin(orders, eq(orders.visitId, tableVisits.id))
    .where(
      and(
        eq(tableVisits.restaurantId, membership.restaurantId),
        isNull(tableVisits.closedAt),
      ),
    )
    .groupBy(tableVisits.id, tableVisits.tableId, tableVisits.openedAt)
    .orderBy(tableVisits.openedAt);

  return Response.json({
    visits: rows.map((row) => ({
      id: row.id,
      tableId: row.tableId,
      openedAt: row.openedAt.toISOString(),
      orderCount: row.orderCount,
      total: Number(row.total),
    })),
  });
}