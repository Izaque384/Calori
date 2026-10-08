"use server";

import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { assertPermission, canOperate } from "@/lib/permissions";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const nextStatus: Record<string, "preparing" | "ready" | "delivered"> = {
  new: "preparing",
  preparing: "ready",
  ready: "delivered",
};

export async function advanceOrder(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canOperate(role));
  const orderId = String(formData.get("orderId") ?? "");

  if (!orderId) return;

  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurant.id)))
    .limit(1);

  if (!order || order.status === "cancelled" || order.status === "delivered") return;

  const status = nextStatus[order.status];
  if (!status) return;

  await db
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(orders.id, order.id),
        eq(orders.restaurantId, restaurant.id),
        eq(orders.status, order.status),
      ),
    );

  revalidatePath("/dashboard/pedidos");
  revalidatePath("/dashboard");
}

export async function cancelOrder(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canOperate(role));
  const orderId = String(formData.get("orderId") ?? "");

  if (!orderId) return;

  await db
    .update(orders)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.restaurantId, restaurant.id),
        inArray(orders.status, ["new", "preparing", "ready"]),
      ),
    );

  revalidatePath("/dashboard/pedidos");
  revalidatePath("/dashboard");
}
