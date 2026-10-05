import { createHash } from "crypto";
import { db } from "@/db";
import { tableSessions } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";

export function hashTableSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getValidTableSession(params: {
  token: string;
  restaurantId: string;
  tableId: string;
}) {
  const tokenHash = hashTableSessionToken(params.token);

  const [session] = await db
    .select({ id: tableSessions.id, expiresAt: tableSessions.expiresAt })
    .from(tableSessions)
    .where(
      and(
        eq(tableSessions.tokenHash, tokenHash),
        eq(tableSessions.restaurantId, params.restaurantId),
        eq(tableSessions.tableId, params.tableId),
        gt(tableSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return session ?? null;
}
