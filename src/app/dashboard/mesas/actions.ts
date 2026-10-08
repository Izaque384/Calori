"use server";

import { db } from "@/db";
import { serviceRequests, tableSessions, tableVisits, tables } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { assertPermission, canManageTables } from "@/lib/permissions";
import { closeExpiredTableVisits } from "@/lib/table-visit";
import { and, eq, isNull, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

export async function createTable(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageTables(role));
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return;
  if (name.length > 80) {
    throw new Error("O nome da mesa deve ter no máximo 80 caracteres.");
  }

  const [duplicateName] = await db
    .select({ id: tables.id })
    .from(tables)
    .where(
      and(
        eq(tables.restaurantId, restaurant.id),
        sql`lower(trim(${tables.name})) = lower(trim(${name}))`,
      ),
    )
    .limit(1);

  if (duplicateName) {
    throw new Error("Já existe uma mesa com esse nome.");
  }

  let publicCode: string | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = randomBytes(4).toString("hex").toUpperCase();

    const [existing] = await db
      .select({ id: tables.id })
      .from(tables)
      .where(eq(tables.publicCode, candidate))
      .limit(1);

    if (!existing) {
      publicCode = candidate;
      break;
    }
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
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageTables(role));
  const tableId = String(formData.get("tableId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  if (!tableId) return;

  if (active) {
    await closeExpiredTableVisits(restaurant.id);

    const [openVisit] = await db
      .select({ id: tableVisits.id })
      .from(tableVisits)
      .where(
        and(
          eq(tableVisits.restaurantId, restaurant.id),
          eq(tableVisits.tableId, tableId),
          isNull(tableVisits.closedAt),
        ),
      )
      .limit(1);

    if (openVisit) {
      throw new Error("Encerre a visita da mesa antes de pausá-la.");
    }
  }

  await db
    .update(tables)
    .set({ active: !active })
    .where(and(eq(tables.id, tableId), eq(tables.restaurantId, restaurant.id)));

  revalidatePath("/dashboard/mesas");
}


export async function closeTableVisit(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageTables(role));
  const tableId = String(formData.get("tableId") ?? "");

  if (!tableId) return;

  const [visit] = await db
    .select({ id: tableVisits.id })
    .from(tableVisits)
    .where(
      and(
        eq(tableVisits.restaurantId, restaurant.id),
        eq(tableVisits.tableId, tableId),
        isNull(tableVisits.closedAt),
      ),
    )
    .limit(1);

  if (!visit) return;

  const closedAt = new Date();

  await db.batch([
    db
      .update(tableVisits)
      .set({ closedAt })
      .where(
        and(
          eq(tableVisits.id, visit.id),
          eq(tableVisits.restaurantId, restaurant.id),
          isNull(tableVisits.closedAt),
        ),
      ),
    db
      .update(tableSessions)
      .set({ expiresAt: closedAt })
      .where(
        and(
          eq(tableSessions.restaurantId, restaurant.id),
          eq(tableSessions.visitId, visit.id),
        ),
      ),
    db
      .update(serviceRequests)
      .set({ status: "cancelled", handledAt: closedAt })
      .where(
        and(
          eq(serviceRequests.restaurantId, restaurant.id),
          eq(serviceRequests.visitId, visit.id),
          eq(serviceRequests.status, "pending"),
        ),
      ),
  ]);

  revalidatePath("/dashboard/mesas");
  revalidatePath("/dashboard/atendimento");
  revalidatePath("/dashboard");
}
