"use server";

import { db } from "@/db";
import { serviceRequests } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function handleServiceRequest(formData: FormData) {
  const { restaurant } = await requireCurrentRestaurant();
  const requestId = String(formData.get("requestId") ?? "");

  if (!requestId) return;

  await db
    .update(serviceRequests)
    .set({
      status: "handled",
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
