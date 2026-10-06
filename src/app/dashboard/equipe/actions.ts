"use server";

import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { restaurantMembers, teamInvites } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { assertPermission, canManageSettings } from "@/lib/permissions";
import { hashInviteToken } from "@/lib/team-invites";
import { and, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type InviteState = {
  error?: string;
  success?: string;
  inviteUrl?: string;
  emailSent?: boolean;
} | null;

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://calorixx.vercel.app").replace(/\/$/, "");
}

export async function createTeamInvite(
  _prevState: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const { session, restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageSettings(role));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const invitedRole = String(formData.get("role") ?? "") as "manager" | "staff";

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  if (!["manager", "staff"].includes(invitedRole)) {
    return { error: "Selecione uma função válida." };
  }

  if (email === session.user.email?.toLowerCase()) {
    return { error: "Você já faz parte deste restaurante." };
  }

  const [member] = await db
    .select({ userId: restaurantMembers.userId })
    .from(restaurantMembers)
    .where(
      and(
        eq(restaurantMembers.restaurantId, restaurant.id),
        eq(restaurantMembers.email, email),
      ),
    )
    .limit(1);

  if (member) {
    return { error: "Esse e-mail já faz parte da equipe." };
  }

  const [pending] = await db
    .select({ id: teamInvites.id })
    .from(teamInvites)
    .where(
      and(
        eq(teamInvites.restaurantId, restaurant.id),
        eq(teamInvites.email, email),
        eq(teamInvites.status, "pending"),
        gt(teamInvites.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (pending) {
    return { error: "Já existe um convite ativo para esse e-mail." };
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(teamInvites).values({
    restaurantId: restaurant.id,
    email,
    role: invitedRole,
    tokenHash: hashInviteToken(token),
    invitedByUserId: session.user.id,
    expiresAt,
  });

  const inviteUrl = `${appUrl()}/convite/${token}`;

  revalidatePath("/dashboard/equipe");

  return {
    success: "Convite criado. Copie o link e envie para a pessoa convidada.",
    inviteUrl,
    emailSent: false,
  };
}

export async function revokeTeamInvite(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageSettings(role));
  const inviteId = String(formData.get("inviteId") ?? "");
  if (!inviteId) return;

  await db
    .update(teamInvites)
    .set({ status: "revoked" })
    .where(
      and(
        eq(teamInvites.id, inviteId),
        eq(teamInvites.restaurantId, restaurant.id),
        eq(teamInvites.status, "pending"),
      ),
    );

  revalidatePath("/dashboard/equipe");
}

export async function updateMemberRole(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageSettings(role));
  const userId = String(formData.get("userId") ?? "");
  const nextRole = String(formData.get("role") ?? "") as "manager" | "staff";

  if (!userId || !["manager", "staff"].includes(nextRole)) return;

  const [member] = await db
    .select({ role: restaurantMembers.role })
    .from(restaurantMembers)
    .where(
      and(
        eq(restaurantMembers.restaurantId, restaurant.id),
        eq(restaurantMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!member || member.role === "owner") return;

  await db
    .update(restaurantMembers)
    .set({ role: nextRole })
    .where(
      and(
        eq(restaurantMembers.restaurantId, restaurant.id),
        eq(restaurantMembers.userId, userId),
      ),
    );

  revalidatePath("/dashboard/equipe");
}

export async function removeTeamMember(formData: FormData) {
  const { session, restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageSettings(role));
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === session.user.id) return;

  const [member] = await db
    .select({ role: restaurantMembers.role })
    .from(restaurantMembers)
    .where(
      and(
        eq(restaurantMembers.restaurantId, restaurant.id),
        eq(restaurantMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!member || member.role === "owner") return;

  await db
    .delete(restaurantMembers)
    .where(
      and(
        eq(restaurantMembers.restaurantId, restaurant.id),
        eq(restaurantMembers.userId, userId),
      ),
    );

  revalidatePath("/dashboard/equipe");
}
