import { createHmac, timingSafeEqual } from "node:crypto";

export const CALORI_STRIPE_PRICE_ID = "price_1UOGO6ADIPgNEfyPUBvksSl9";
export const CALORI_STRIPE_PAYMENT_LINK = "https://buy.stripe.com/bJedR8epV3FUcQrcJd3VC00";
export const CALORI_STRIPE_PORTAL_LOGIN = "https://billing.stripe.com/p/login/bJedR8epV3FUcQrcJd3VC00";

export function createCheckoutReference(params: {
  restaurantId: string;
  secret: string;
}) {
  const signature = createHmac("sha256", params.secret)
    .update(params.restaurantId)
    .digest("hex");
  return `${params.restaurantId}.${signature}`;
}

export function verifyCheckoutReference(params: {
  reference: string;
  secret: string;
}) {
  const separator = params.reference.lastIndexOf(".");
  if (separator <= 0) return null;

  const restaurantId = params.reference.slice(0, separator);
  const supplied = params.reference.slice(separator + 1);
  const expected = createHmac("sha256", params.secret)
    .update(restaurantId)
    .digest("hex");

  try {
    const suppliedBuffer = Buffer.from(supplied, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (
      suppliedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      return null;
    }

    return restaurantId;
  } catch {
    return null;
  }
}

export function buildCaloriCheckoutUrl(params: {
  restaurantId: string;
  referenceSecret: string;
  email?: string | null;
}) {
  const url = new URL(CALORI_STRIPE_PAYMENT_LINK);
  url.searchParams.set(
    "client_reference_id",
    createCheckoutReference({
      restaurantId: params.restaurantId,
      secret: params.referenceSecret,
    }),
  );
  if (params.email) url.searchParams.set("prefilled_email", params.email);
  return url.toString();
}

export function verifyStripeSignature(params: {
  payload: string;
  signatureHeader: string;
  secret: string;
  toleranceSeconds?: number;
}) {
  const toleranceSeconds = params.toleranceSeconds ?? 300;
  const pairs = params.signatureHeader.split(",").map((part) => part.trim());
  const timestamp = pairs
    .find((part) => part.startsWith("t="))
    ?.slice(2);
  const signatures = pairs
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - timestampNumber);
  if (ageSeconds > toleranceSeconds) return false;

  const expected = createHmac("sha256", params.secret)
    .update(`${timestamp}.${params.payload}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");

  return signatures.some((signature) => {
    try {
      const signatureBuffer = Buffer.from(signature, "hex");
      return (
        signatureBuffer.length === expectedBuffer.length &&
        timingSafeEqual(signatureBuffer, expectedBuffer)
      );
    } catch {
      return false;
    }
  });
}

export function mapStripeSubscriptionStatus(status: string) {
  if (status === "active" || status === "trialing") return "active" as const;
  if (status === "canceled") return "canceled" as const;
  return "past_due" as const;
}
