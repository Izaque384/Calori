import test from "node:test";
import assert from "node:assert/strict";
import {
  CALORI_MONTHLY_PRICE_CENTS,
  getSubscriptionSummary,
} from "../src/lib/subscription.ts";

test("Calori monthly plan remains R$59", () => {
  assert.equal(CALORI_MONTHLY_PRICE_CENTS, 5900);
});

test("trial grants access while it is still active", () => {
  const summary = getSubscriptionSummary({
    status: "trialing",
    trialEndsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  });

  assert.equal(summary.isTrialActive, true);
  assert.equal(summary.hasAccess, true);
  assert.ok(summary.trialDaysRemaining >= 1);
});

test("expired trial no longer counts as active entitlement", () => {
  const summary = getSubscriptionSummary({
    status: "trialing",
    trialEndsAt: new Date(Date.now() - 1000),
  });

  assert.equal(summary.isTrialActive, false);
  assert.equal(summary.hasAccess, false);
  assert.equal(summary.trialDaysRemaining, 0);
});

test("active subscription grants access independently of trial", () => {
  const summary = getSubscriptionSummary({
    status: "active",
    trialEndsAt: null,
  });

  assert.equal(summary.isActive, true);
  assert.equal(summary.hasAccess, true);
});
