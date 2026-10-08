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

  const blobAuthConfigured = Boolean(
    process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN,
  );

  const body = {
    ok: databaseOk,
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
        configured: blobAuthConfigured,
      },
    },
  };

  return Response.json(body, {
    status: databaseOk ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
