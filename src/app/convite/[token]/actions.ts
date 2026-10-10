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
      workArea: teamInvites.workArea,
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

  const [existing] = await db
    .select({ restaurantId: restaurantMembers.restaurantId })
    .from(restaurantMembers)
    .where(eq(restaurantMembers.userId, session.user.id))
    .limit(1);

  if (existing && existing.restaurantId !== invite.restaurantId) {
    redirect(`/convite/${token}?erro=restaurante`);
  }

  const acceptedAt = new Date();

  if (!existing) {
    await db.batch([
      db.insert(restaurantMembers).values({
        restaurantId: invite.restaurantId,
        userId: session.user.id,
        role: invite.role,
        workArea: invite.workArea,
        email: invite.email,
        displayName: session.user.name || null,
      }),
      db
        .update(teamInvites)
        .set({ status: "accepted", acceptedAt })
        .where(
          and(
            eq(teamInvites.id, invite.id),
            eq(teamInvites.status, "pending"),
          ),
        ),
    ]);
  } else {
    await db
      .update(teamInvites)
      .set({ status: "accepted", acceptedAt })
      .where(
        and(
          eq(teamInvites.id, invite.id),
          eq(teamInvites.status, "pending"),
        ),
      );
  }

  redirect("/dashboard");
}
