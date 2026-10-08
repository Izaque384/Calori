import { db } from "@/db";
import { apiRateLimits } from "@/db/schema";
import { lt, sql } from "drizzle-orm";

export async function checkRateLimit(params: {
  scope: string;
  identity: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / params.windowMs) * params.windowMs);
  const expiresAt = new Date(windowStart.getTime() + params.windowMs * 2);
  const bucketKey = `${params.scope}:${params.identity}`.slice(0, 500);

  const [row] = await db
    .insert(apiRateLimits)
    .values({
      bucketKey,
      windowStart,
      count: 1,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [apiRateLimits.bucketKey, apiRateLimits.windowStart],
      set: {
        count: sql`${apiRateLimits.count} + 1`,
        expiresAt,
      },
    })
    .returning({ count: apiRateLimits.count });

  if ((row?.count ?? 0) === 1) {
    await db
      .delete(apiRateLimits)
      .where(lt(apiRateLimits.expiresAt, new Date()))
      .catch(() => undefined);
  }

  const count = row?.count ?? params.limit + 1;
  return {
    allowed: count <= params.limit,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((windowStart.getTime() + params.windowMs - now) / 1000),
    ),
  };
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return Response.json(
    { error: "Muitas tentativas em pouco tempo. Aguarde alguns instantes." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}
