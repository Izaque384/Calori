"use server";

import { auth } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export type AuthState = { error?: string } | null;

export async function signUpWithEmail(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) return { error: "Preencha todos os campos." };
  if (password.length < 8) return { error: "Use uma senha com pelo menos 8 caracteres." };

  const { error } = await auth.signUp.email({ name, email, password });
  if (error) return { error: error.message || "Não foi possível criar sua conta." };

  redirect("/onboarding");
}
