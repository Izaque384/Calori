"use server";

import { db } from "@/db";
import { restaurants } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { assertPermission, canManageSettings } from "@/lib/permissions";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function normalizeOptional(value: FormDataEntryValue | null, maxLength: number) {
  const text = String(value ?? "").trim().slice(0, maxLength);
  return text || null;
}

function normalizeColor(value: FormDataEntryValue | null) {
  const color = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#C75A3A";
}

export async function updateRestaurantSettings(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();

  assertPermission(canManageSettings(role));

  const name = String(formData.get("name") ?? "").trim().slice(0, 100);

  if (name.length < 2) {
    throw new Error("Informe um nome válido para o restaurante.");
  }

  const phone = normalizeOptional(formData.get("phone"), 40);
  const address = normalizeOptional(formData.get("address"), 300);
  const primaryColor = normalizeColor(formData.get("primaryColor"));

  await db
    .update(restaurants)
    .set({
      name,
      phone,
      address,
      primaryColor,
      updatedAt: new Date(),
    })
    .where(eq(restaurants.id, restaurant.id));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard/cardapio");
  revalidatePath("/dashboard/mesas");
  revalidatePath("/dashboard/pedidos");
  revalidatePath("/dashboard/atendimento");
  revalidatePath(`/r/${restaurant.slug}`, "layout");
}
