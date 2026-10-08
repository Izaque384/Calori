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
  if (name.length > 120) return { error: "O nome do restaurante está muito longo." };
  if (phone.length > 40) return { error: "O telefone está muito longo." };
  if (address.length > 240) return { error: "O endereço está muito longo." };

  const baseSlug = slugify(name) || "restaurante";
  const suffix = crypto.randomUUID().slice(0, 6);
  const slug = `${baseSlug}-${suffix}`;

  let creationFailed = false;

  try {
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const restaurantId = crypto.randomUUID();

    await db.batch([
      db.insert(restaurants).values({
        id: restaurantId,
        name,
        slug,
        phone: phone || null,
        address: address || null,
        primaryColor: "#c75a3a",
        subscriptionStatus: "trialing",
        trialEndsAt,
      }),
      db.insert(restaurantMembers).values({
        restaurantId,
        userId: session.user.id,
        role: "owner",
        email: session.user.email || null,
        displayName: session.user.name || null,
      }),
    ]);
  } catch {
    creationFailed = true;
  }

  if (creationFailed) {
    const [membership] = await db
      .select({ restaurantId: restaurantMembers.restaurantId })
      .from(restaurantMembers)
      .where(eq(restaurantMembers.userId, session.user.id))
      .limit(1);

    if (!membership) {
      return { error: "Não conseguimos criar o restaurante. Tente novamente." };
    }
  }

  redirect("/dashboard");
}
