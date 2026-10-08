import { db } from "@/db";
import { orders, restaurantMembers, restaurants } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { getSubscriptionSummary } from "@/lib/subscription";
import { desc, eq } from "drizzle-orm";

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
      id: orders.id,
      number: orders.number,
      status: orders.status,
      updatedAt: orders.updatedAt,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.restaurantId, membership.restaurantId))
    .orderBy(desc(orders.createdAt))
    .limit(100);

  return Response.json({
    orders: rows.map((order) => ({
      id: order.id,
      number: order.number,
      status: order.status,
      updatedAt: order.updatedAt.toISOString(),
      createdAt: order.createdAt.toISOString(),
    })),
  });
}
