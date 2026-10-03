import { db } from "@/db";
import { restaurantMembers, restaurants } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export async function requireCurrentRestaurant() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const [membership] = await db
    .select({
      restaurantId: restaurantMembers.restaurantId,
      role: restaurantMembers.role,
    })
    .from(restaurantMembers)
    .where(eq(restaurantMembers.userId, session.user.id))
    .limit(1);

  if (!membership) {
    redirect("/onboarding");
  }

  const [restaurant] = await db
    .select({
      id: restaurants.id,
      name: restaurants.name,
      slug: restaurants.slug,
    })
    .from(restaurants)
    .where(and(eq(restaurants.id, membership.restaurantId), eq(restaurants.active, true)))
    .limit(1);

  if (!restaurant) {
    redirect("/onboarding");
  }

  return {
    session,
    restaurant,
    role: membership.role,
  };
}
