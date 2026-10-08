import { db } from "@/db";
import { serviceRequests, tableSessions, tableVisits } from "@/db/schema";
import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";

export const TABLE_VISIT_DURATION_MS = 12 * 60 * 60 * 1000;

export async function closeExpiredTableVisits(restaurantId: string) {
  const now = new Date();

  const expired = await db
    .select({ id: tableVisits.id })
    .from(tableVisits)
    .where(
      and(
        eq(tableVisits.restaurantId, restaurantId),
        isNull(tableVisits.closedAt),
        lte(tableVisits.expiresAt, now),
      ),
    );

  if (expired.length === 0) return [];

  const visitIds = expired.map((visit) => visit.id);

  await db.batch([
    db
      .update(tableVisits)
      .set({ closedAt: now })
      .where(
        and(
          eq(tableVisits.restaurantId, restaurantId),
          inArray(tableVisits.id, visitIds),
          isNull(tableVisits.closedAt),
        ),
      ),
    db
      .update(tableSessions)
      .set({ expiresAt: now })
      .where(
        and(
          eq(tableSessions.restaurantId, restaurantId),
          inArray(tableSessions.visitId, visitIds),
        ),
      ),
    db
      .update(serviceRequests)
      .set({ status: "cancelled", handledAt: now })
      .where(
        and(
          eq(serviceRequests.restaurantId, restaurantId),
          inArray(serviceRequests.visitId, visitIds),
          eq(serviceRequests.status, "pending"),
        ),
      ),
  ]);

  return visitIds;
}

export async function getOpenTableVisit(params: {
  restaurantId: string;
  tableId: string;
}) {
  const [visit] = await db
    .select({
      id: tableVisits.id,
      openedAt: tableVisits.openedAt,
      expiresAt: tableVisits.expiresAt,
    })
    .from(tableVisits)
    .where(
      and(
        eq(tableVisits.restaurantId, params.restaurantId),
        eq(tableVisits.tableId, params.tableId),
        isNull(tableVisits.closedAt),
        gt(tableVisits.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return visit ?? null;
}

export async function getOrCreateOpenTableVisit(params: {
  restaurantId: string;
  tableId: string;
}) {
  await closeExpiredTableVisits(params.restaurantId);

  const existing = await getOpenTableVisit(params);
  if (existing) return existing;

  const expiresAt = new Date(Date.now() + TABLE_VISIT_DURATION_MS);

  try {
    const [created] = await db
      .insert(tableVisits)
      .values({
        restaurantId: params.restaurantId,
        tableId: params.tableId,
        expiresAt,
      })
      .onConflictDoNothing()
      .returning({
        id: tableVisits.id,
        openedAt: tableVisits.openedAt,
        expiresAt: tableVisits.expiresAt,
      });

    if (created) return created;
  } catch {
    // Outro dispositivo pode ter aberto a mesma visita simultaneamente.
  }

  const concurrent = await getOpenTableVisit(params);
  if (!concurrent) {
    throw new Error("Não foi possível iniciar a visita da mesa.");
  }

  return concurrent;
}
