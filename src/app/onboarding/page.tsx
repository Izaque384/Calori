import { auth } from "@/lib/auth/server";
import { acceptPendingInviteForUser } from "@/lib/team-invites";
import { redirect } from "next/navigation";
import OnboardingForm from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const acceptedInvite = await acceptPendingInviteForUser({
    userId: session.user.id,
    email: session.user.email,
    displayName: session.user.name,
  });

  if (acceptedInvite) {
    redirect("/dashboard");
  }

  return <OnboardingForm />;
}
