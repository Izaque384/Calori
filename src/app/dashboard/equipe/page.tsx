import { db } from "@/db";
import { restaurantMembers, teamInvites } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { signOut } from "../actions";
import InviteForm from "./invite-form";
import { removeTeamMember, revokeTeamInvite, updateMemberRole } from "./actions";

export const dynamic = "force-dynamic";

function roleLabel(role: string) {
  if (role === "owner") return "Owner";
  if (role === "manager") return "Manager";
  return "Staff";
}

export default async function TeamPage() {
  const { session, restaurant, role } = await requireCurrentRestaurant();
  if (role !== "owner") redirect("/dashboard");

  await db
    .update(restaurantMembers)
    .set({
      email: session.user.email?.toLowerCase() || null,
      displayName: session.user.name || null,
    })
    .where(
      and(
        eq(restaurantMembers.restaurantId, restaurant.id),
        eq(restaurantMembers.userId, session.user.id),
      ),
    );

  const [members, invites] = await Promise.all([
    db
      .select({
        userId: restaurantMembers.userId,
        role: restaurantMembers.role,
        email: restaurantMembers.email,
        displayName: restaurantMembers.displayName,
        createdAt: restaurantMembers.createdAt,
      })
      .from(restaurantMembers)
      .where(eq(restaurantMembers.restaurantId, restaurant.id))
      .orderBy(desc(restaurantMembers.createdAt)),
    db
      .select({
        id: teamInvites.id,
        email: teamInvites.email,
        role: teamInvites.role,
        status: teamInvites.status,
        expiresAt: teamInvites.expiresAt,
        createdAt: teamInvites.createdAt,
      })
      .from(teamInvites)
      .where(eq(teamInvites.restaurantId, restaurant.id))
      .orderBy(desc(teamInvites.createdAt)),
  ]);

  const pendingInvites = invites.filter(
    (invite) => invite.status === "pending" && invite.expiresAt > new Date(),
  );

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand">Calori<span>.</span></div>
        <div className="restaurant-pill">{restaurant.name}</div>
        <nav>
          <a href="/dashboard">Visão geral</a>
          <a href="/dashboard/pedidos">Pedidos</a>
          <a href="/dashboard/cardapio">Cardápio</a>
          <a href="/dashboard/mesas">Mesas</a>
          <a href="/dashboard/atendimento">Atendimento</a>
          <a href="/dashboard/relatorios">Relatórios</a>
          <a className="active" href="/dashboard/equipe">Equipe</a>
          <a href="/dashboard/configuracoes">Configurações</a>
        </nav>
        <form action={signOut}><button className="ghost-button" type="submit">Sair</button></form>
      </aside>

      <section className="dashboard-content team-content">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Equipe</p>
            <h1>Acessos do restaurante.</h1>
            <p className="muted">Convide pessoas e escolha o nível de acesso de cada membro.</p>
          </div>
          <div className="status-chip">{members.length} {members.length === 1 ? "membro" : "membros"}</div>
        </div>

        <section className="settings-card team-invite-card">
          <div className="settings-card-heading">
            <div>
              <span className="section-kicker">Novo acesso</span>
              <h2>Convidar por e-mail</h2>
            </div>
          </div>
          <InviteForm />
        </section>

        <section className="team-section">
          <div className="section-title">
            <div>
              <span className="section-kicker">Acessos ativos</span>
              <h2>Membros</h2>
            </div>
          </div>

          <div className="team-list">
            {members.map((member) => {
              const isOwner = member.role === "owner";
              const isCurrentUser = member.userId === session.user.id;

              return (
                <article className="team-row" key={member.userId}>
                  <div className="team-person">
                    <div className="team-avatar">
                      {(member.displayName || member.email || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <strong>{member.displayName || (isCurrentUser ? session.user.name : null) || "Membro da equipe"}</strong>
                      <span>{member.email || (isCurrentUser ? session.user.email : null) || "E-mail não disponível"}</span>
                    </div>
                  </div>

                  <div className="team-row-actions">
                    {isOwner ? (
                      <span className="role-pill owner">Owner</span>
                    ) : (
                      <>
                        <form action={updateMemberRole} className="role-form">
                          <input type="hidden" name="userId" value={member.userId} />
                          <select name="role" defaultValue={member.role}>
                            <option value="manager">Manager</option>
                            <option value="staff">Staff</option>
                          </select>
                          <button className="secondary-button" type="submit">Salvar</button>
                        </form>
                        <form action={removeTeamMember}>
                          <input type="hidden" name="userId" value={member.userId} />
                          <button className="text-button danger" type="submit">Remover</button>
                        </form>
                      </>
                    )}
                    {isCurrentUser && <span className="role-you">Você</span>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {pendingInvites.length > 0 && (
          <section className="team-section">
            <div className="section-title">
              <div>
                <span className="section-kicker">Aguardando aceite</span>
                <h2>Convites pendentes</h2>
              </div>
            </div>

            <div className="team-list">
              {pendingInvites.map((invite) => (
                <article className="team-row" key={invite.id}>
                  <div className="team-person">
                    <div className="team-avatar pending">↗</div>
                    <div>
                      <strong>{invite.email}</strong>
                      <span>
                        {roleLabel(invite.role)} · expira em{" "}
                        {invite.expiresAt.toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                  <form action={revokeTeamInvite}>
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <button className="text-button danger" type="submit">Revogar</button>
                  </form>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
