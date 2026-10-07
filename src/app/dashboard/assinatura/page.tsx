import { db } from "@/db";
import { restaurants } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { formatCaloriMonthlyPrice, getSubscriptionSummary } from "@/lib/subscription";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { signOut } from "../actions";

export const dynamic = "force-dynamic";

function statusLabel(status: string, trialActive: boolean) {
  if (trialActive) return "Período gratuito";
  if (status === "active") return "Assinatura ativa";
  if (status === "past_due") return "Pagamento pendente";
  if (status === "canceled") return "Assinatura cancelada";
  return "Trial encerrado";
}

export default async function SubscriptionPage() {
  const { restaurant, role } = await requireCurrentRestaurant();
  if (role !== "owner") redirect("/dashboard");

  const [row] = await db
    .select({
      subscriptionStatus: restaurants.subscriptionStatus,
      trialEndsAt: restaurants.trialEndsAt,
      subscriptionStartedAt: restaurants.subscriptionStartedAt,
      subscriptionCanceledAt: restaurants.subscriptionCanceledAt,
    })
    .from(restaurants)
    .where(eq(restaurants.id, restaurant.id))
    .limit(1);

  if (!row) redirect("/dashboard");

  const summary = getSubscriptionSummary({
    status: row.subscriptionStatus,
    trialEndsAt: row.trialEndsAt,
  });

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
          <a href="/dashboard/equipe">Equipe</a>
          <a className="active" href="/dashboard/assinatura">Assinatura</a>
          <a href="/dashboard/configuracoes">Configurações</a>
        </nav>
        <form action={signOut}><button className="ghost-button" type="submit">Sair</button></form>
      </aside>

      <section className="dashboard-content subscription-content">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Assinatura</p>
            <h1>Um plano. Todos os recursos.</h1>
            <p className="muted">Sem níveis ou recursos bloqueados por plano.</p>
          </div>
          <span className="status-chip">
            {statusLabel(row.subscriptionStatus, summary.isTrialActive)}
          </span>
        </div>

        <section className="subscription-plan-card">
          <div>
            <span className="section-kicker">Calori</span>
            <h2>{formatCaloriMonthlyPrice()}<small>/mês</small></h2>
            <p>Todos os recursos. Um restaurante. Cancele quando quiser.</p>
          </div>

          <div className="subscription-plan-features">
            <span>Cardápio digital e QR Codes</span>
            <span>Pedidos e acompanhamento em tempo real</span>
            <span>Atendimento e conta da mesa</span>
            <span>Equipe e permissões</span>
            <span>Relatórios operacionais</span>
          </div>
        </section>

        <section className="subscription-status-card">
          {summary.isTrialActive ? (
            <>
              <span className="section-kicker">14 dias grátis</span>
              <h2>{summary.trialDaysRemaining} {summary.trialDaysRemaining === 1 ? "dia restante" : "dias restantes"}</h2>
              <p>Seu período gratuito termina em {row.trialEndsAt?.toLocaleDateString("pt-BR")}.</p>
              <p className="muted">Nenhum cartão é necessário durante o período gratuito.</p>
            </>
          ) : summary.isActive ? (
            <>
              <span className="section-kicker">Assinatura ativa</span>
              <h2>Calori ativo</h2>
              {row.subscriptionStartedAt && (
                <p>Assinatura iniciada em {row.subscriptionStartedAt.toLocaleDateString("pt-BR")}.</p>
              )}
            </>
          ) : (
            <>
              <span className="section-kicker">Cobrança ainda não conectada</span>
              <h2>Seu trial terminou.</h2>
              <p>
                O Calori continuará acessível enquanto a cobrança ainda não estiver integrada.
                Quando o checkout for conectado, esta tela será o ponto de contratação e cancelamento.
              </p>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
