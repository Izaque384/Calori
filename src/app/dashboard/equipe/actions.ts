"use server";

import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { restaurantMembers, teamInvites } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { assertPermission, canManageSettings } from "@/lib/permissions";
import { ensureTeamSchema, hashInviteToken } from "@/lib/team-invites";
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

async function sendInviteEmail(params: {
  email: string;
  restaurantName: string;
  role: "manager" | "staff";
  inviteUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) return false;

  const roleLabel = params.role === "manager" ? "gerente" : "equipe";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.email],
      subject: `Convite para acessar ${params.restaurantName} no Calori`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f1f1f">
          <h1 style="font-family:Georgia,serif">Você foi convidado para o Calori.</h1>
          <p>Você recebeu acesso como <strong>${roleLabel}</strong> de <strong>${params.restaurantName}</strong>.</p>
          <p><a href="${params.inviteUrl}" style="display:inline-block;background:#c75a3a;color:white;text-decoration:none;padding:12px 18px;border-radius:10px">Aceitar convite</a></p>
          <p style="font-size:12px;color:#666">Este convite expira em 7 dias.</p>
        </div>
      `,
    }),
  });

  return response.ok;
}

export async function createTeamInvite(
  _prevState: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const { session, restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageSettings(role));
  await ensureTeamSchema();

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
  const emailSent = await sendInviteEmail({
    email,
    restaurantName: restaurant.name,
    role: invitedRole,
    inviteUrl,
  });

  revalidatePath("/dashboard/equipe");

  return {
    success: emailSent
      ? "Convite enviado por e-mail."
      : "Convite criado. O envio de e-mail ainda não está configurado; copie o link abaixo.",
    inviteUrl,
    emailSent,
  };
}

export async function revokeTeamInvite(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageSettings(role));
  await ensureTeamSchema();

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
  await ensureTeamSchema();

  const userId = String(formData.get("userId") ?? "");
  const nextRole = String(formData.get("role") ?? "") as "manager" | "staff";

  if (!userId || !["manager", "staff"].includes(nextRole)) return;

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
  await ensureTeamSchema();

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
