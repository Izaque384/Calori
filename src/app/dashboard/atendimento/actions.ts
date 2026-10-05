"use server";

import { db } from "@/db";
import { serviceRequests, tableSessions } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function handleServiceRequest(formData: FormData) {
  const { restaurant } = await requireCurrentRestaurant();
  const requestId = String(formData.get("requestId") ?? "");

  if (!requestId) return;

  const [request] = await db
    .select({
      id: serviceRequests.id,
      type: serviceRequests.type,
      sessionId: serviceRequests.sessionId,
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

  await db
    .update(serviceRequests)
    .set({
      status: "handled",
      handledAt,
    })
    .where(
      and(
        eq(serviceRequests.id, request.id),
        eq(serviceRequests.restaurantId, restaurant.id),
        eq(serviceRequests.status, "pending"),
      ),
    );

  if (request.type === "request_bill") {
    await db
      .update(tableSessions)
      .set({ expiresAt: handledAt })
      .where(
        and(
          eq(tableSessions.tableId, request.tableId),
          eq(tableSessions.restaurantId, restaurant.id),
        ),
      );
  }

  revalidatePath("/dashboard/atendimento");
  revalidatePath("/dashboard");
}

export async function cancelServiceRequest(formData: FormData) {
  const { restaurant } = await requireCurrentRestaurant();
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
