export const CALORI_MONTHLY_PRICE_CENTS = 5900;
export const CALORI_TRIAL_DAYS = 14;

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export function getSubscriptionSummary(params: {
  status: string;
  trialEndsAt: Date | null;
}) {
  const now = Date.now();
  const trialEndsAt = params.trialEndsAt?.getTime() ?? null;
  const trialRemainingMs = trialEndsAt ? trialEndsAt - now : 0;
  const trialDaysRemaining =
    trialRemainingMs > 0
      ? Math.max(1, Math.ceil(trialRemainingMs / (24 * 60 * 60 * 1000)))
      : 0;

  const isTrialActive = params.status === "trialing" && trialDaysRemaining > 0;
  const isActive = params.status === "active";

  return {
    status: params.status as SubscriptionStatus,
    trialDaysRemaining,
    isTrialActive,
    isActive,
    hasAccess: isTrialActive || isActive,
  };
}

export function formatCaloriMonthlyPrice() {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(CALORI_MONTHLY_PRICE_CENTS / 100);
}
