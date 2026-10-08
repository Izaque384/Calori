import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  buildCaloriCheckoutUrl,
  createCheckoutReference,
  mapStripeSubscriptionStatus,
  verifyCheckoutReference,
  verifyStripeSignature,
} from "../src/lib/stripe-billing.ts";

test("checkout URL carries restaurant reference and owner email", () => {
  const url = new URL(
    buildCaloriCheckoutUrl({
      restaurantId: "restaurant-123",
      referenceSecret: "checkout-secret",
      email: "owner@example.com",
    }),
  );

  const reference = url.searchParams.get("client_reference_id");
  assert.ok(reference);
  assert.equal(
    verifyCheckoutReference({
      reference,
      secret: "checkout-secret",
    }),
    "restaurant-123",
  );
  assert.equal(url.searchParams.get("prefilled_email"), "owner@example.com");
});

test("tampered checkout reference is rejected", () => {
  const reference = createCheckoutReference({
    restaurantId: "restaurant-123",
    secret: "checkout-secret",
  });

  assert.equal(
    verifyCheckoutReference({
      reference: reference.replace("restaurant-123", "restaurant-999"),
      secret: "checkout-secret",
    }),
    null,
  );
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
