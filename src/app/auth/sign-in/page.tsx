"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInWithEmail } from "./actions";

export default function SignInPage() {
  const [state, action, pending] = useActionState(signInWithEmail, null);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">Calori<span>.</span></Link>
        <p className="eyebrow">Bem-vindo de volta</p>
        <h1>Entre no Calori</h1>
        <p className="muted">Acesse o painel do seu restaurante.</p>
        <form action={action} className="form-stack">
          <label>E-mail<input name="email" type="email" required autoComplete="email" placeholder="voce@restaurante.com" /></label>
          <label>Senha<input name="password" type="password" required autoComplete="current-password" placeholder="Sua senha" /></label>
          {state?.error && <p className="form-error">{state.error}</p>}
          <button className="primary-button" type="submit" disabled={pending}>{pending ? "Entrando..." : "Entrar"}</button>
        </form>
        <p className="auth-footer">Ainda não tem conta? <Link href="/auth/sign-up">Criar conta</Link></p>
      </section>
    </main>
  );
}
