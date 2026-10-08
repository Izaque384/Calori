import { db } from "@/db";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { appSecrets, restaurants } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { formatCaloriMonthlyPrice, getSubscriptionSummary } from "@/lib/subscription";
import { buildCaloriCheckoutUrl, CALORI_STRIPE_PORTAL_LOGIN } from "@/lib/stripe-billing";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function statusLabel(status: string, trialActive: boolean) {
  if (trialActive) return "Período gratuito";
  if (status === "active") return "Assinatura ativa";
  if (status === "past_due") return "Pagamento pendente";
  if (status === "canceled") return "Assinatura cancelada";
  return "Trial encerrado";
}

export default async function SubscriptionPage() {
  const { restaurant, role, session } = await requireCurrentRestaurant({ allowExpiredSubscription: true });

  const [[row], [checkoutSecret]] = await Promise.all([
    db
      .select({
      subscriptionStatus: restaurants.subscriptionStatus,
      trialEndsAt: restaurants.trialEndsAt,
      subscriptionStartedAt: restaurants.subscriptionStartedAt,
      subscriptionCanceledAt: restaurants.subscriptionCanceledAt,
      stripeCustomerId: restaurants.stripeCustomerId,
      stripeSubscriptionId: restaurants.stripeSubscriptionId,
      subscriptionCurrentPeriodEnd: restaurants.subscriptionCurrentPeriodEnd,
    })
    .from(restaurants)
      .where(eq(restaurants.id, restaurant.id))
      .limit(1),
    db
      .select({ value: appSecrets.value })
      .from(appSecrets)
      .where(eq(appSecrets.key, "stripe_checkout_reference_secret"))
      .limit(1),
  ]);

  const checkoutReferenceSecret =
    process.env.STRIPE_CHECKOUT_REFERENCE_SECRET ?? checkoutSecret?.value ?? null;

  if (!row || !checkoutReferenceSecret) redirect("/dashboard");

  const summary = getSubscriptionSummary({
    status: row.subscriptionStatus,
    trialEndsAt: row.trialEndsAt,
  });

  const checkoutUrl = buildCaloriCheckoutUrl({
    restaurantId: restaurant.id,
    referenceSecret: checkoutReferenceSecret,
    email: session.user.email,
  });
  const canManageBilling = role === "owner";

  return (
    <main className="dashboard-shell">
      <DashboardSidebar restaurantName={restaurant.name} role={role} activePath="/dashboard/assinatura" />

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
              {canManageBilling && (
                <p className="subscription-inline-note">
                  A cobrança só começa quando você contratar o plano após o trial.
                </p>
              )}
            </>
          ) : summary.isActive ? (
            <>
              <span className="section-kicker">Assinatura ativa</span>
              <h2>Calori ativo</h2>
              {row.subscriptionStartedAt && (
                <p>Assinatura iniciada em {row.subscriptionStartedAt.toLocaleDateString("pt-BR")}.</p>
              )}
              {row.subscriptionCurrentPeriodEnd && (
                <p className="muted">
                  Ciclo atual até {row.subscriptionCurrentPeriodEnd.toLocaleDateString("pt-BR")}.
                </p>
              )}
              {canManageBilling && (
                <a className="primary-button subscription-action-link" href={CALORI_STRIPE_PORTAL_LOGIN}>
                  Gerenciar cobrança
                </a>
              )}
            </>
          ) : (
            <>
              <span className="section-kicker">
                {row.subscriptionStatus === "past_due" ? "Pagamento pendente" : "Trial encerrado"}
              </span>
              <h2>
                {row.subscriptionStatus === "past_due"
                  ? "Sua assinatura precisa de atenção."
                  : "Continue usando o Calori por R$ 59/mês."}
              </h2>
              {canManageBilling ? (
                <>
                  <p>
                    Todos os recursos continuam no mesmo plano. Você pode contratar agora ou gerenciar
                    uma assinatura existente pela Stripe.
                  </p>
                  <div className="subscription-action-row">
                    {row.subscriptionStatus === "past_due" && row.stripeCustomerId ? (
                      <a className="primary-button subscription-action-link" href={CALORI_STRIPE_PORTAL_LOGIN}>
                        Corrigir pagamento
                      </a>
                    ) : (
                      <a className="primary-button subscription-action-link" href={checkoutUrl}>
                        Assinar o Calori
                      </a>
                    )}
                    {row.subscriptionStatus !== "past_due" && row.stripeCustomerId && (
                      <a className="secondary-link-button subscription-action-link" href={CALORI_STRIPE_PORTAL_LOGIN}>
                        Gerenciar cobrança
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <p>
                  A assinatura precisa ser regularizada pelo proprietário do restaurante.
                </p>
              )}
            </>
          )}
        </section>
      </section>
    </main>
  );
}
