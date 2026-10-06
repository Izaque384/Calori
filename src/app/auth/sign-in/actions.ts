"use server";

import { auth } from "@/lib/auth/server";
import { db } from "@/db";
import { restaurantMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { acceptPendingInviteForUser } from "@/lib/team-invites";

export type AuthState = { error?: string } | null;

export async function signInWithEmail(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const { data, error } = await auth.signIn.email({ email, password });
  if (error || !data?.user) return { error: error?.message || "E-mail ou senha inválidos." };

  const acceptedInvite = await acceptPendingInviteForUser({
    userId: data.user.id,
    email: data.user.email,
    displayName: data.user.name,
  });

  if (acceptedInvite) redirect("/dashboard");

  const membership = await db
    .select({ restaurantId: restaurantMembers.restaurantId })
    .from(restaurantMembers)
    .where(eq(restaurantMembers.userId, data.user.id))
    .limit(1);

  redirect(membership.length ? "/dashboard" : "/onboarding");
}
