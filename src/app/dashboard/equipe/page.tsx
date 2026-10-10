import { db } from "@/db";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { restaurantMembers, teamInvites } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import InviteForm from "./invite-form";
import { removeTeamMember, revokeTeamInvite, updateMemberRole } from "./actions";

export const dynamic = "force-dynamic";

function roleLabel(role: string) {
  if (role === "owner") return "Owner";
  if (role === "manager") return "Manager";
  return "Staff";
}

function workAreaLabel(workArea: string | null) {
  if (workArea === "waiter") return "Salão · garçom";
  if (workArea === "kitchen") return "Cozinha · cozinheiro";
  return "Sem personagem no painel";
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
        workArea: restaurantMembers.workArea,
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
        workArea: teamInvites.workArea,
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
      <DashboardSidebar restaurantName={restaurant.name} role={role} activePath="/dashboard/equipe" />

      <section className="dashboard-content team-content">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Equipe</p>
            <h1>Acessos do restaurante.</h1>
            <p className="muted">Convide pessoas, defina o acesso e indique o setor operacional. O Calori só mostra garçons e cozinheiros no salão quando esse setor estiver cadastrado.</p>
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
                      <small className="team-work-area">{workAreaLabel(member.workArea)}</small>
                    </div>
                  </div>

                  <div className="team-row-actions">
                    {isOwner ? (
                      <span className="role-pill owner">Owner</span>
                    ) : (
                      <>
                        <form action={updateMemberRole} className="role-form">
                          <input type="hidden" name="userId" value={member.userId} />
                          <select name="role" defaultValue={member.role} aria-label="Nível de acesso">
                            <option value="manager">Manager</option>
                            <option value="staff">Staff</option>
                          </select>
                          <select name="workArea" defaultValue={member.workArea ?? ""} aria-label="Setor no painel">
                            <option value="">Sem personagem</option>
                            <option value="waiter">Salão · garçom</option>
                            <option value="kitchen">Cozinha · cozinheiro</option>
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
                        {roleLabel(invite.role)} · {workAreaLabel(invite.workArea)} · expira em{" "}
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
