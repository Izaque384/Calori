"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("calori.ui.error", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <main className="auth-shell">
      <section className="auth-card app-error-card">
        <span className="brand">Calori<span>.</span></span>
        <p className="eyebrow">Algo não saiu como esperado</p>
        <h1>Não foi possível concluir esta ação.</h1>
        <p className="muted">
          Seus dados permanecem salvos. Tente novamente; se o problema persistir,
          volte ao painel e continue por outra área.
        </p>
        <div className="app-error-actions">
          <button className="primary-button" type="button" onClick={reset}>
            Tentar novamente
          </button>
          <a className="secondary-link-button" href="/dashboard">
            Voltar ao painel
          </a>
        </div>
        {error.digest && (
          <small className="app-error-reference">
            Referência: {error.digest}
          </small>
        )}
      </section>
    </main>
  );
}
