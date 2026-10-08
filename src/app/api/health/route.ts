import { list } from "@vercel/blob";
import { db } from "@/db";
import { appSecrets } from "@/db/schema";
import { inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  let databaseOk = false;
  let databaseLatencyMs: number | null = null;
  let billingConfigured = false;
  let mediaStorageOk = false;
  let mediaStorageLatencyMs: number | null = null;

  try {
    const dbStartedAt = Date.now();
    await db.execute(sql`select 1 as ok`);

    const secrets = await db
      .select({ key: appSecrets.key })
      .from(appSecrets)
      .where(
        inArray(appSecrets.key, [
          "stripe_webhook_secret",
          "stripe_checkout_reference_secret",
        ]),
      );

    databaseOk = true;
    databaseLatencyMs = Date.now() - dbStartedAt;
    const databaseSecretsConfigured =
      new Set(secrets.map((item) => item.key)).size === 2;
    billingConfigured = Boolean(
      (process.env.STRIPE_WEBHOOK_SECRET &&
        process.env.STRIPE_CHECKOUT_REFERENCE_SECRET) ||
        databaseSecretsConfigured,
    );
  } catch (error) {
    console.error("calori.health.database_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  try {
    const blobStartedAt = Date.now();
    await list({ limit: 1 });
    mediaStorageOk = true;
    mediaStorageLatencyMs = Date.now() - blobStartedAt;
  } catch (error) {
    console.error("calori.health.media_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  const ok = databaseOk && billingConfigured && mediaStorageOk;

  return Response.json(
    {
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
          ok: mediaStorageOk,
          latencyMs: mediaStorageLatencyMs,
        },
        billing: {
          configured: billingConfigured,
        },
      },
    },
    {
      status: ok ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
