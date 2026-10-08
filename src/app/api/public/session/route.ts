import { randomBytes } from "crypto";
import { db } from "@/db";
import { restaurants, tableSessions, tables } from "@/db/schema";
import { hashTableSessionToken } from "@/lib/table-session";
import { getOrCreateOpenTableVisit } from "@/lib/table-visit";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getSubscriptionSummary } from "@/lib/subscription";
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

  const limit = await checkRateLimit({
    scope: "table-session",
    identity: `${restaurantSlug}:${tableCode}`,
    limit: 24,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const [restaurant] = await db
    .select({
      id: restaurants.id,
      subscriptionStatus: restaurants.subscriptionStatus,
      trialEndsAt: restaurants.trialEndsAt,
    })
    .from(restaurants)
    .where(and(eq(restaurants.slug, restaurantSlug), eq(restaurants.active, true)))
    .limit(1);

  if (!restaurant) {
    return Response.json({ error: "Restaurante indisponível." }, { status: 404 });
  }

  const subscription = getSubscriptionSummary({
    status: restaurant.subscriptionStatus,
    trialEndsAt: restaurant.trialEndsAt,
  });

  if (!subscription.hasAccess) {
    return Response.json(
      { error: "O cardápio está temporariamente indisponível." },
      { status: 402 },
    );
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

  const visit = await getOrCreateOpenTableVisit({
    restaurantId: restaurant.id,
    tableId: table.id,
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

  await db.insert(tableSessions).values({
    restaurantId: restaurant.id,
    tableId: table.id,
    visitId: visit.id,
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
