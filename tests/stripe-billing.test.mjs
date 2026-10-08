import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  buildCaloriCheckoutUrl,
  mapStripeSubscriptionStatus,
  verifyStripeSignature,
} from "../src/lib/stripe-billing.ts";

test("checkout URL carries restaurant reference and owner email", () => {
  const url = new URL(
    buildCaloriCheckoutUrl({
      restaurantId: "restaurant-123",
      email: "owner@example.com",
    }),
  );

  assert.equal(url.searchParams.get("client_reference_id"), "restaurant-123");
  assert.equal(url.searchParams.get("prefilled_email"), "owner@example.com");
});

test("Stripe webhook signature is verified with timestamp tolerance", () => {
  const secret = "whsec_test";
  const payload = JSON.stringify({ id: "evt_test", type: "invoice.paid" });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  assert.equal(
    verifyStripeSignature({
      payload,
      signatureHeader: `t=${timestamp},v1=${signature}`,
      secret,
    }),
    true,
  );

  assert.equal(
    verifyStripeSignature({
      payload: payload + "tampered",
      signatureHeader: `t=${timestamp},v1=${signature}`,
      secret,
    }),
    false,
  );
});

test("Stripe subscription states map to Calori access states", () => {
  assert.equal(mapStripeSubscriptionStatus("active"), "active");
  assert.equal(mapStripeSubscriptionStatus("trialing"), "active");
  assert.equal(mapStripeSubscriptionStatus("past_due"), "past_due");
  assert.equal(mapStripeSubscriptionStatus("unpaid"), "past_due");
  assert.equal(mapStripeSubscriptionStatus("canceled"), "canceled");
});
