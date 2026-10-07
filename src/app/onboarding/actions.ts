"use server";

import { db } from "@/db";
import { restaurantMembers, restaurants } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export type OnboardingState = { error?: string } | null;

export async function createRestaurant(_prevState: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const existing = await db
    .select({ restaurantId: restaurantMembers.restaurantId })
    .from(restaurantMembers)
    .where(eq(restaurantMembers.userId, session.user.id))
    .limit(1);
  if (existing.length) redirect("/dashboard");

  const name = String(formData.get("restaurantName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!name) return { error: "Informe o nome do restaurante." };

  const baseSlug = slugify(name) || "restaurante";
  const suffix = crypto.randomUUID().slice(0, 6);
  const slug = `${baseSlug}-${suffix}`;

  try {
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const [restaurant] = await db
      .insert(restaurants)
      .values({
        name,
        slug,
        phone: phone || null,
        address: address || null,
        primaryColor: "#c75a3a",
        subscriptionStatus: "trialing",
        trialEndsAt,
      })
      .returning({ id: restaurants.id });

    await db.insert(restaurantMembers).values({
      restaurantId: restaurant.id,
      userId: session.user.id,
      role: "owner",
    });
  } catch {
    return { error: "Não conseguimos criar o restaurante. Tente novamente." };
  }

  redirect("/dashboard");
}
