import { db } from "@/db";
import { restaurants, teamInvites } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { ensureTeamSchema, hashInviteToken } from "@/lib/team-invites";
import { and, eq, gt } from "drizzle-orm";
import Link from "next/link";
import { acceptTeamInvite } from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ erro?: string }>;
};

export default async function InvitePage({ params, searchParams }: Props) {
  const { token } = await params;
  const query = await searchParams;

  await ensureTeamSchema();

  const [invite] = await db
    .select({
      id: teamInvites.id,
      email: teamInvites.email,
      role: teamInvites.role,
      restaurantName: restaurants.name,
    })
    .from(teamInvites)
    .innerJoin(restaurants, eq(teamInvites.restaurantId, restaurants.id))
    .where(
      and(
        eq(teamInvites.tokenHash, hashInviteToken(token)),
        eq(teamInvites.status, "pending"),
        gt(teamInvites.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!invite) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <Link href="/" className="brand">Calori<span>.</span></Link>
          <p className="eyebrow">Convite</p>
          <h1>Este convite não está mais disponível.</h1>
          <p className="muted">Ele pode ter expirado, sido revogado ou já ter sido utilizado.</p>
          <Link className="primary-button auth-link-button" href="/auth/sign-in">Ir para o login</Link>
        </section>
      </main>
    );
  }

  const { data: session } = await auth.getSession();
  const roleLabel = invite.role === "manager" ? "manager" : "staff";

  return (
    <main className="auth-shell">
      <section className="auth-card invite-accept-card">
        <Link href="/" className="brand">Calori<span>.</span></Link>
        <p className="eyebrow">Convite para equipe</p>
        <h1>Você foi convidado para {invite.restaurantName}.</h1>
        <p className="muted">
          O acesso será criado como <strong>{roleLabel}</strong> para o e-mail <strong>{invite.email}</strong>.
        </p>

        {query.erro === "email" && (
          <p className="form-error">Entre com o mesmo e-mail que recebeu o convite.</p>
        )}

        {session?.user ? (
          <>
            <div className="invite-signed-user">
              <span>Conectado como</span>
              <strong>{session.user.email}</strong>
            </div>
            <form action={acceptTeamInvite}>
              <input type="hidden" name="token" value={token} />
              <button className="primary-button" type="submit">Aceitar convite</button>
            </form>
          </>
        ) : (
          <div className="invite-auth-actions">
            <Link className="primary-button auth-link-button" href="/auth/sign-in">
              Entrar para aceitar
            </Link>
            <Link className="secondary-link-button" href="/auth/sign-up">
              Criar conta
            </Link>
            <p>Use o e-mail <strong>{invite.email}</strong>. Após entrar, o Calori reconhecerá o convite automaticamente.</p>
          </div>
        )}
      </section>
    </main>
  );
}
