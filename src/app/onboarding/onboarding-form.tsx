"use client";

import { useActionState } from "react";
import { createRestaurant } from "./actions";

export default function OnboardingForm() {
  const [state, action, pending] = useActionState(createRestaurant, null);

  return (
    <main className="auth-shell onboarding-shell">
      <section className="onboarding-layout">
        <aside className="onboarding-intro">
          <div className="brand">Calori<span>.</span></div>
          <div className="onboarding-step-pill">Configuração inicial · 1 de 3</div>
          <h1>Seu restaurante pronto para receber pedidos.</h1>
          <p>
            Informe só o essencial agora. Depois você cadastra o cardápio,
            cria as mesas e gera os QR Codes direto no painel.
          </p>

          <div className="onboarding-roadmap">
            <div className="active">
              <span>1</span>
              <div><strong>Restaurante</strong><small>Identidade básica</small></div>
            </div>
            <div>
              <span>2</span>
              <div><strong>Cardápio</strong><small>Produtos e adicionais</small></div>
            </div>
            <div>
              <span>3</span>
              <div><strong>Mesas</strong><small>QR Codes e operação</small></div>
            </div>
          </div>

          <div className="onboarding-trial-note">
            <strong>14 dias grátis</strong>
            <span>Sem cartão. Todos os recursos liberados.</span>
          </div>
        </aside>

        <section className="auth-card onboarding-card">
          <p className="eyebrow">Primeiros passos</p>
          <h2>Conte um pouco sobre o restaurante.</h2>
          <p className="muted">Você poderá alterar essas informações depois em Configurações.</p>

          <form action={action} className="form-stack">
            <label>
              Nome do restaurante
              <input
                name="restaurantName"
                required
                autoFocus
                placeholder="Ex.: Casa Calori"
                autoComplete="organization"
              />
              <small>Esse nome aparecerá no cardápio público.</small>
            </label>

            <label>
              Telefone ou WhatsApp
              <input
                name="phone"
                inputMode="tel"
                placeholder="(00) 00000-0000"
                autoComplete="tel"
              />
              <small>Opcional. Pode ser preenchido depois.</small>
            </label>

            <label>
              Endereço
              <input
                name="address"
                placeholder="Rua, número e cidade"
                autoComplete="street-address"
              />
              <small>Opcional. Útil para identificar a unidade.</small>
            </label>

            {state?.error && <p className="form-error">{state.error}</p>}

            <button className="primary-button onboarding-submit" type="submit" disabled={pending}>
              <span>{pending ? "Preparando seu painel..." : "Criar restaurante e continuar"}</span>
              {!pending && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="onboarding-privacy">Leva menos de 1 minuto. Nenhum cartão será solicitado.</p>
        </section>
      </section>
    </main>
  );
}
