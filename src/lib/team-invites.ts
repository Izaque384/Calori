import { createHash } from "node:crypto";
import { db } from "@/db";
import { restaurantMembers, teamInvites } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function acceptPendingInviteForUser(params: {
  userId: string;
  email: string;
  displayName?: string | null;
}) {
  const email = params.email.trim().toLowerCase();
  if (!email) return null;

  const [invite] = await db
    .select({
      id: teamInvites.id,
      restaurantId: teamInvites.restaurantId,
      role: teamInvites.role,
    })
    .from(teamInvites)
    .where(
      and(
        eq(teamInvites.email, email),
        eq(teamInvites.status, "pending"),
        gt(teamInvites.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!invite) return null;

  const existing = await db
    .select({ restaurantId: restaurantMembers.restaurantId })
    .from(restaurantMembers)
    .where(eq(restaurantMembers.userId, params.userId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  await db.insert(restaurantMembers).values({
    restaurantId: invite.restaurantId,
    userId: params.userId,
    role: invite.role,
    email,
    displayName: params.displayName?.trim() || null,
  });

  await db
    .update(teamInvites)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(teamInvites.id, invite.id));

  return { restaurantId: invite.restaurantId };
}
