import { db } from "@/db";
import { restaurants, serviceRequests, tables } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getValidTableSession } from "@/lib/table-session";

type Payload = {
  restaurantSlug?: string;
  tableCode?: string;
  sessionToken?: string;
  type?: "call_waiter" | "request_bill";
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
  const sessionToken = String(payload.sessionToken ?? "").trim();
  const type = payload.type;

  if (!restaurantSlug || !tableCode || !sessionToken || !type || !["call_waiter", "request_bill"].includes(type)) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
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

  const [existing] = await db
    .select({ id: serviceRequests.id })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.restaurantId, restaurant.id),
        eq(serviceRequests.tableId, table.id),
        eq(serviceRequests.sessionId, tableSession.id),
        eq(serviceRequests.type, type),
        eq(serviceRequests.status, "pending"),
      ),
    )
    .limit(1);

  if (existing) {
    return Response.json({
      ok: true,
      duplicate: true,
      message: type === "call_waiter" ? "O garçom já foi chamado." : "A conta já foi solicitada.",
    });
  }

  await db.insert(serviceRequests).values({
    restaurantId: restaurant.id,
    tableId: table.id,
    sessionId: tableSession.id,
    type,
    status: "pending",
  });

  return Response.json({
    ok: true,
    duplicate: false,
    message: type === "call_waiter"
      ? "Chamamos o atendimento para sua mesa."
      : "Seu pedido de conta foi enviado.",
  });
}
