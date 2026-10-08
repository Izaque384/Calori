import { db } from "@/db";
import { restaurantMembers, restaurants, serviceRequests, tables } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { getSubscriptionSummary } from "@/lib/subscription";
import { and, asc, eq } from "drizzle-orm";

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
      subscriptionStatus: restaurants.subscriptionStatus,
      trialEndsAt: restaurants.trialEndsAt,
      active: restaurants.active,
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
      id: serviceRequests.id,
      type: serviceRequests.type,
      createdAt: serviceRequests.createdAt,
      tableName: tables.name,
    })
    .from(serviceRequests)
    .innerJoin(tables, eq(serviceRequests.tableId, tables.id))
    .where(
      and(
        eq(serviceRequests.restaurantId, membership.restaurantId),
        eq(serviceRequests.status, "pending"),
      ),
    )
    .orderBy(asc(serviceRequests.createdAt));

  return Response.json({
    requests: rows.map((row) => ({
      id: row.id,
      type: row.type,
      tableName: row.tableName,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}
