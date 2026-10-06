"use server";

import { db } from "@/db";
import { restaurantMembers, teamInvites } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { hashInviteToken } from "@/lib/team-invites";
import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";

export async function acceptTeamInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/auth/sign-in");

  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const [invite] = await db
    .select({
      id: teamInvites.id,
      restaurantId: teamInvites.restaurantId,
      email: teamInvites.email,
      role: teamInvites.role,
    })
    .from(teamInvites)
    .where(
      and(
        eq(teamInvites.tokenHash, hashInviteToken(token)),
        eq(teamInvites.status, "pending"),
        gt(teamInvites.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!invite) redirect("/dashboard");

  if (session.user.email?.trim().toLowerCase() !== invite.email.trim().toLowerCase()) {
    redirect(`/convite/${token}?erro=email`);
  }

  const existing = await db
    .select({ restaurantId: restaurantMembers.restaurantId })
    .from(restaurantMembers)
    .where(eq(restaurantMembers.userId, session.user.id))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(restaurantMembers).values({
      restaurantId: invite.restaurantId,
      userId: session.user.id,
      role: invite.role,
      email: invite.email,
      displayName: session.user.name || null,
    });
  }

  await db
    .update(teamInvites)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(teamInvites.id, invite.id));

  redirect("/dashboard");
}
