import { db } from "@/db";
import { restaurants, stripeWebhookEvents } from "@/db/schema";
import {
  CALORI_STRIPE_PRICE_ID,
  mapStripeSubscriptionStatus,
  verifyCheckoutReference,
  verifyStripeSignature,
} from "@/lib/stripe-billing";
import { and, eq, lt, or } from "drizzle-orm";

type StripeLikeObject = Record<string, unknown>;

function asObject(value: unknown): StripeLikeObject {
  return value && typeof value === "object" ? (value as StripeLikeObject) : {};
}

function stringId(value: unknown) {
  if (typeof value === "string") return value;
  const object = asObject(value);
  return typeof object.id === "string" ? object.id : null;
}

function numberDate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value * 1000);
}

function subscriptionIdFromInvoice(object: StripeLikeObject) {
  const direct = stringId(object.subscription);
  if (direct) return direct;

  const parent = asObject(object.parent);
  const details = asObject(parent.subscription_details);
  return stringId(details.subscription);
}

function currentPeriodEndFromSubscription(object: StripeLikeObject) {
  const direct = numberDate(object.current_period_end);
  if (direct) return direct;

  const items = asObject(object.items);
  const data = Array.isArray(items.data) ? items.data : [];
  const first = asObject(data[0]);
  return numberDate(first.current_period_end);
}

function priceIdFromSubscription(object: StripeLikeObject) {
  const items = asObject(object.items);
  const data = Array.isArray(items.data) ? items.data : [];
  const first = asObject(data[0]);
  return stringId(first.price) ?? CALORI_STRIPE_PRICE_ID;
}

function findStripeSecrets() {
  return {
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? null,
    checkoutReferenceSecret:
      process.env.STRIPE_CHECKOUT_REFERENCE_SECRET ?? null,
  };
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signatureHeader = request.headers.get("stripe-signature") ?? "";
  const { webhookSecret, checkoutReferenceSecret } = findStripeSecrets();

  if (!webhookSecret || !checkoutReferenceSecret || !signatureHeader) {
    return Response.json({ error: "Webhook not configured." }, { status: 503 });
  }

  if (
    !verifyStripeSignature({
      payload,
      signatureHeader,
      secret: webhookSecret,
    })
  ) {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: StripeLikeObject;
  try {
    event = JSON.parse(payload) as StripeLikeObject;
  } catch {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  const eventId = typeof event.id === "string" ? event.id : null;
  const type = typeof event.type === "string" ? event.type : "";
  const data = asObject(event.data);
  const object = asObject(data.object);

  if (!eventId || !type) {
    return Response.json({ error: "Invalid Stripe event." }, { status: 400 });
  }

  const [claimed] = await db
    .insert(stripeWebhookEvents)
    .values({
      eventId,
      eventType: type,
    })
    .onConflictDoNothing()
    .returning({ eventId: stripeWebhookEvents.eventId });

  if (!claimed) {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    if (type === "checkout.session.completed") {
      const checkoutReference =
        typeof object.client_reference_id === "string"
          ? object.client_reference_id
          : null;
      const restaurantId = checkoutReference
        ? verifyCheckoutReference({
            reference: checkoutReference,
            secret: checkoutReferenceSecret,
          })
        : null;
      const customerId = stringId(object.customer);
      const subscriptionId = stringId(object.subscription);
      const paymentStatus =
        typeof object.payment_status === "string"
          ? object.payment_status
          : "";

      if (restaurantId && subscriptionId && (paymentStatus === "paid" || paymentStatus === "no_payment_required")) {
        await db
          .update(restaurants)
          .set({
            subscriptionStatus: "active",
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: CALORI_STRIPE_PRICE_ID,
            subscriptionStartedAt: new Date(),
            subscriptionCanceledAt: null,
            updatedAt: new Date(),
          })
          .where(eq(restaurants.id, restaurantId));
      }
    }

    if (type === "invoice.paid" || type === "invoice.payment_failed") {
      const subscriptionId = subscriptionIdFromInvoice(object);
      const customerId = stringId(object.customer);

      if (subscriptionId || customerId) {
        await db
          .update(restaurants)
          .set({
            subscriptionStatus: type === "invoice.paid" ? "active" : "past_due",
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: CALORI_STRIPE_PRICE_ID,
            subscriptionCanceledAt: null,
            updatedAt: new Date(),
          })
          .where(
            or(
              subscriptionId ? eq(restaurants.stripeSubscriptionId, subscriptionId) : undefined,
              customerId ? eq(restaurants.stripeCustomerId, customerId) : undefined,
            ),
          );
      }
    }

    if (
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted"
    ) {
      const subscriptionId = stringId(object.id);
      const customerId = stringId(object.customer);
      const stripeStatus =
        type === "customer.subscription.deleted"
          ? "canceled"
          : typeof object.status === "string"
            ? object.status
            : "past_due";

      if (subscriptionId || customerId) {
        const internalStatus = mapStripeSubscriptionStatus(stripeStatus);
        await db
          .update(restaurants)
          .set({
            subscriptionStatus: internalStatus,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: priceIdFromSubscription(object),
            subscriptionCurrentPeriodEnd: currentPeriodEndFromSubscription(object),
            subscriptionCanceledAt:
              internalStatus === "canceled" ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(
            or(
              subscriptionId ? eq(restaurants.stripeSubscriptionId, subscriptionId) : undefined,
              customerId ? eq(restaurants.stripeCustomerId, customerId) : undefined,
            ),
          );
      }
    }
    const processedAt = new Date();

    await db
      .update(stripeWebhookEvents)
      .set({ processedAt })
      .where(eq(stripeWebhookEvents.eventId, eventId));

    await db
      .delete(stripeWebhookEvents)
      .where(
        lt(
          stripeWebhookEvents.processedAt,
          new Date(processedAt.getTime() - 90 * 24 * 60 * 60 * 1000),
        ),
      )
      .catch(() => undefined);

    if (Math.random() < 0.02) {
      const retentionCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      await db
        .delete(stripeWebhookEvents)
        .where(lt(stripeWebhookEvents.receivedAt, retentionCutoff))
        .catch(() => undefined);
    }
  } catch (error) {
    await db
      .delete(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.eventId, eventId))
      .catch(() => undefined);

    console.error("calori.stripe.webhook_failed", {
      eventId,
      type,
      error: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return Response.json({ received: true });
}
