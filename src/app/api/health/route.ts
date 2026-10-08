import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  let databaseOk = false;
  let databaseLatencyMs: number | null = null;

  try {
    const dbStartedAt = Date.now();
    await db.execute(sql`select 1 as ok`);
    databaseOk = true;
    databaseLatencyMs = Date.now() - dbStartedAt;
  } catch (error) {
    console.error("calori.health.database_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  const mediaConfigured = Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.VERCEL_OIDC_TOKEN ||
      process.env.BLOB_STORE_ID,
  );

  const billingConfigured = Boolean(
    process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_CHECKOUT_REFERENCE_SECRET,
  );

  const ok = databaseOk && mediaConfigured && billingConfigured;

  const body = {
    ok,
    app: "calori",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? "local",
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    checks: {
      database: {
        ok: databaseOk,
        latencyMs: databaseLatencyMs,
      },
      mediaStorage: {
        configured: mediaConfigured,
      },
      billing: {
        configured: billingConfigured,
      },
    },
  };

  return Response.json(body, {
    status: ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
