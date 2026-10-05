import { db } from "@/db";
import { orders, restaurants, tableSessions, tables } from "@/db/schema";
import { getValidTableSession } from "@/lib/table-session";
import { and, asc, eq, gt, inArray, ne } from "drizzle-orm";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantSlug = String(url.searchParams.get("restaurantSlug") ?? "").trim();
  const tableCode = String(url.searchParams.get("tableCode") ?? "").trim();
  const sessionToken = String(url.searchParams.get("sessionToken") ?? "").trim();

  if (!restaurantSlug || !tableCode || !sessionToken) {
    return Response.json({ error: "Sessão da mesa inválida." }, { status: 400 });
  }

  const [restaurant] = await db
    .select({ id: restaurants.id })
    .from(restaurants)
    .where(and(eq(restaurants.slug, restaurantSlug), eq(restaurants.active, true)))
    .limit(1);

  if (!restaurant) {
    return Response.json({ error: "Restaurante indisponível." }, { status: 404 });
  }

  const [table] = await db
    .select({ id: tables.id, name: tables.name })
    .from(tables)
    .where(
      and(
        eq(tables.restaurantId, restaurant.id),
        eq(tables.publicCode, tableCode),
        eq(tables.active, true),
      ),
    )
    .limit(1);

  if (!table) {
    return Response.json({ error: "Mesa indisponível." }, { status: 404 });
  }

  const tableSession = await getValidTableSession({
    token: sessionToken,
    restaurantId: restaurant.id,
    tableId: table.id,
  });

  if (!tableSession) {
    return Response.json(
      { error: "Sua sessão da mesa expirou. Reabra o cardápio pelo QR Code." },
      { status: 401 },
    );
  }

  const activeSessions = await db
    .select({ id: tableSessions.id })
    .from(tableSessions)
    .where(
      and(
        eq(tableSessions.restaurantId, restaurant.id),
        eq(tableSessions.tableId, table.id),
        gt(tableSessions.expiresAt, new Date()),
      ),
    );

  const activeSessionIds = activeSessions.map((session) => session.id);

  const rows = activeSessionIds.length
    ? await db
        .select({
          id: orders.id,
          number: orders.number,
          status: orders.status,
          total: orders.total,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurant.id),
            eq(orders.tableId, table.id),
            inArray(orders.sessionId, activeSessionIds),
            ne(orders.status, "cancelled"),
          ),
        )
        .orderBy(asc(orders.createdAt))
    : [];

  const total = rows.reduce((sum, order) => sum + Number(order.total), 0);

  return Response.json({
    bill: {
      table: table.name,
      orderCount: rows.length,
      total: Number(total.toFixed(2)),
      orders: rows.map((order) => ({
        id: order.id,
        number: order.number,
        status: order.status,
        total: Number(order.total),
        createdAt: order.createdAt.toISOString(),
      })),
    },
  });
}
