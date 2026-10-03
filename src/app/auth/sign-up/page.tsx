"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpWithEmail } from "./actions";

export default function SignUpPage() {
  const [state, action, pending] = useActionState(signUpWithEmail, null);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">Calori<span>.</span></Link>
        <p className="eyebrow">Comece seu restaurante</p>
        <h1>Crie sua conta</h1>
        <p className="muted">Seu cardápio, pedidos e atendimento em um só lugar.</p>
        <form action={action} className="form-stack">
          <label>Seu nome<input name="name" required autoComplete="name" placeholder="Nome do responsável" /></label>
          <label>E-mail<input name="email" type="email" required autoComplete="email" placeholder="voce@restaurante.com" /></label>
          <label>Senha<input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" /></label>
          {state?.error && <p className="form-error">{state.error}</p>}
          <button className="primary-button" type="submit" disabled={pending}>{pending ? "Criando conta..." : "Criar conta"}</button>
        </form>
        <p className="auth-footer">Já tem uma conta? <Link href="/auth/sign-in">Entrar</Link></p>
      </section>
    </main>
  );
}
