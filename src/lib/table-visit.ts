import { db } from "@/db";
import { tableVisits } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export async function getOpenTableVisit(params: {
  restaurantId: string;
  tableId: string;
}) {
  const [visit] = await db
    .select({
      id: tableVisits.id,
      openedAt: tableVisits.openedAt,
    })
    .from(tableVisits)
    .where(
      and(
        eq(tableVisits.restaurantId, params.restaurantId),
        eq(tableVisits.tableId, params.tableId),
        isNull(tableVisits.closedAt),
      ),
    )
    .limit(1);

  return visit ?? null;
}

export async function getOrCreateOpenTableVisit(params: {
  restaurantId: string;
  tableId: string;
}) {
  const existing = await getOpenTableVisit(params);
  if (existing) return existing;

  try {
    const [created] = await db
      .insert(tableVisits)
      .values({
        restaurantId: params.restaurantId,
        tableId: params.tableId,
      })
      .onConflictDoNothing()
      .returning({
        id: tableVisits.id,
        openedAt: tableVisits.openedAt,
      });

    if (created) return created;
  } catch {
    // Another device may have opened the same table visit concurrently.
  }

  const concurrent = await getOpenTableVisit(params);
  if (!concurrent) {
    throw new Error("Não foi possível iniciar a visita da mesa.");
  }

  return concurrent;
}
