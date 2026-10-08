"use server";

import { db } from "@/db";
import { serviceRequests, tableSessions, tableVisits } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { assertPermission, canOperate } from "@/lib/permissions";
import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function handleServiceRequest(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canOperate(role));
  const requestId = String(formData.get("requestId") ?? "");

  if (!requestId) return;

  const [request] = await db
    .select({
      id: serviceRequests.id,
      type: serviceRequests.type,
      sessionId: serviceRequests.sessionId,
      visitId: serviceRequests.visitId,
      tableId: serviceRequests.tableId,
    })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.id, requestId),
        eq(serviceRequests.restaurantId, restaurant.id),
        eq(serviceRequests.status, "pending"),
      ),
    )
    .limit(1);

  if (!request) return;

  const handledAt = new Date();

  if (request.type === "request_bill" && request.visitId) {
    await db.batch([
      db
        .update(serviceRequests)
        .set({ status: "handled", handledAt })
        .where(
          and(
            eq(serviceRequests.id, request.id),
            eq(serviceRequests.restaurantId, restaurant.id),
            eq(serviceRequests.status, "pending"),
          ),
        ),
      db
        .update(tableVisits)
        .set({ closedAt: handledAt })
        .where(
          and(
            eq(tableVisits.id, request.visitId),
            eq(tableVisits.restaurantId, restaurant.id),
            isNull(tableVisits.closedAt),
          ),
        ),
      db
        .update(tableSessions)
        .set({ expiresAt: handledAt })
        .where(
          and(
            eq(tableSessions.restaurantId, restaurant.id),
            eq(tableSessions.visitId, request.visitId),
          ),
        ),
      db
        .update(serviceRequests)
        .set({ status: "cancelled", handledAt })
        .where(
          and(
            eq(serviceRequests.restaurantId, restaurant.id),
            eq(serviceRequests.visitId, request.visitId),
            eq(serviceRequests.status, "pending"),
            ne(serviceRequests.id, request.id),
          ),
        ),
    ]);
  } else {
    await db
      .update(serviceRequests)
      .set({ status: "handled", handledAt })
      .where(
        and(
          eq(serviceRequests.id, request.id),
          eq(serviceRequests.restaurantId, restaurant.id),
          eq(serviceRequests.status, "pending"),
        ),
      );
  }

  revalidatePath("/dashboard/atendimento");
  revalidatePath("/dashboard");
}

export async function cancelServiceRequest(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canOperate(role));
  const requestId = String(formData.get("requestId") ?? "");

  if (!requestId) return;

  await db
    .update(serviceRequests)
    .set({
      status: "cancelled",
      handledAt: new Date(),
    })
    .where(
      and(
        eq(serviceRequests.id, requestId),
        eq(serviceRequests.restaurantId, restaurant.id),
        eq(serviceRequests.status, "pending"),
      ),
    );

  revalidatePath("/dashboard/atendimento");
  revalidatePath("/dashboard");
}
