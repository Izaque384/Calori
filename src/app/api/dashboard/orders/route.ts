import { db } from "@/db";
import { orders, restaurantMembers } from "@/db/schema";
import { auth } from "@/lib/auth/server";
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
