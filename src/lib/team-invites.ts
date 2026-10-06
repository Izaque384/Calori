import { createHash } from "node:crypto";
import { db } from "@/db";
import { restaurantMembers, teamInvites } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function ensureTeamSchema() {
  await db.execute(sql`
    ALTER TABLE restaurant_members
      ADD COLUMN IF NOT EXISTS email text,
      ADD COLUMN IF NOT EXISTS display_name text
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS team_invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      email text NOT NULL,
      role member_role NOT NULL,
      token_hash text NOT NULL UNIQUE,
      invited_by_user_id text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      expires_at timestamptz NOT NULL,
      accepted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS team_invites_restaurant_idx
      ON team_invites (restaurant_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS team_invites_email_idx
      ON team_invites (email)
  `);
}

export async function acceptPendingInviteForUser(params: {
  userId: string;
  email: string;
  displayName?: string | null;
}) {
  await ensureTeamSchema();

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
