import { createHmac, timingSafeEqual } from "node:crypto";

export const CALORI_STRIPE_PRICE_ID = "price_1UOGO6ADIPgNEfyPUBvksSl9";
export const CALORI_STRIPE_PAYMENT_LINK = "https://buy.stripe.com/bJedR8epV3FUcQrcJd3VC00";
export const CALORI_STRIPE_PORTAL_LOGIN = "https://billing.stripe.com/p/login/bJedR8epV3FUcQrcJd3VC00";

export function buildCaloriCheckoutUrl(params: {
  restaurantId: string;
  email?: string | null;
}) {
  const url = new URL(CALORI_STRIPE_PAYMENT_LINK);
  url.searchParams.set("client_reference_id", params.restaurantId);
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
