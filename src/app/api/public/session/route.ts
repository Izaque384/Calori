import { randomBytes } from "crypto";
import { db } from "@/db";
import { restaurants, tableSessions, tables } from "@/db/schema";
import { hashTableSessionToken } from "@/lib/table-session";
import { and, eq } from "drizzle-orm";

type Payload = {
  restaurantSlug?: string;
  tableCode?: string;
};

export async function POST(request: Request) {
  let payload: Payload;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Solicitação inválida." }, { status: 400 });
  }

  const restaurantSlug = String(payload.restaurantSlug ?? "").trim();
  const tableCode = String(payload.tableCode ?? "").trim();

  if (!restaurantSlug || !tableCode) {
    return Response.json({ error: "Mesa inválida." }, { status: 400 });
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
    .select({ id: tables.id })
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

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

  await db.insert(tableSessions).values({
    restaurantId: restaurant.id,
    tableId: table.id,
    tokenHash: hashTableSessionToken(token),
    expiresAt,
  });

  return Response.json({
    ok: true,
    session: {
      token,
      expiresAt: expiresAt.toISOString(),
    },
  });
}
