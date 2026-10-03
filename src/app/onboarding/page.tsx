"use client";

import { useActionState } from "react";
import { createRestaurant } from "./actions";

export default function OnboardingPage() {
  const [state, action, pending] = useActionState(createRestaurant, null);

  return (
    <main className="auth-shell">
      <section className="auth-card onboarding-card">
        <div className="brand">Calori<span>.</span></div>
        <p className="eyebrow">Primeiros passos</p>
        <h1>Vamos preparar seu restaurante.</h1>
        <p className="muted">Comece com o essencial. Você poderá completar tudo depois no painel.</p>
        <form action={action} className="form-stack">
          <label>Nome do restaurante<input name="restaurantName" required placeholder="Ex.: Casa Calori" /></label>
          <label>Telefone ou WhatsApp<input name="phone" placeholder="(00) 00000-0000" /></label>
          <label>Endereço<input name="address" placeholder="Rua, número e cidade" /></label>
          {state?.error && <p className="form-error">{state.error}</p>}
          <button className="primary-button" type="submit" disabled={pending}>{pending ? "Preparando..." : "Criar meu restaurante"}</button>
        </form>
      </section>
    </main>
  );
}
