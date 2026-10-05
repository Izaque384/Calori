"use server";

import { db } from "@/db";
import { serviceRequests, tableSessions, tables } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

export async function createTable(formData: FormData) {
  const { restaurant } = await requireCurrentRestaurant();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return;

  let publicCode = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    publicCode = randomBytes(4).toString("hex").toUpperCase();

    const [existing] = await db
      .select({ id: tables.id })
      .from(tables)
      .where(eq(tables.publicCode, publicCode))
      .limit(1);

    if (!existing) break;
  }

  if (!publicCode) throw new Error("Não foi possível gerar o código da mesa.");

  await db.insert(tables).values({
    restaurantId: restaurant.id,
    name,
    publicCode,
    active: true,
  });

  revalidatePath("/dashboard/mesas");
}

export async function toggleTable(formData: FormData) {
  const { restaurant } = await requireCurrentRestaurant();
  const tableId = String(formData.get("tableId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  if (!tableId) return;

  await db
    .update(tables)
    .set({ active: !active })
    .where(and(eq(tables.id, tableId), eq(tables.restaurantId, restaurant.id)));

  revalidatePath("/dashboard/mesas");
}


export async function closeTableVisit(formData: FormData) {
  const { restaurant } = await requireCurrentRestaurant();
  const tableId = String(formData.get("tableId") ?? "");

  if (!tableId) return;

  const [table] = await db
    .select({ id: tables.id })
    .from(tables)
    .where(and(eq(tables.id, tableId), eq(tables.restaurantId, restaurant.id)))
    .limit(1);

  if (!table) return;

  const closedAt = new Date();

  await db
    .update(tableSessions)
    .set({ expiresAt: closedAt })
    .where(
      and(
        eq(tableSessions.restaurantId, restaurant.id),
        eq(tableSessions.tableId, table.id),
      ),
    );

  await db
    .update(serviceRequests)
    .set({ status: "cancelled", handledAt: closedAt })
    .where(
      and(
        eq(serviceRequests.restaurantId, restaurant.id),
        eq(serviceRequests.tableId, table.id),
        eq(serviceRequests.status, "pending"),
      ),
    );

  revalidatePath("/dashboard/mesas");
  revalidatePath("/dashboard/atendimento");
  revalidatePath("/dashboard");
}
