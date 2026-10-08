"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <main className="global-error-shell">
          <section className="global-error-card">
            <strong>Calori.</strong>
            <h1>O Calori encontrou um erro inesperado.</h1>
            <p>Atualize esta área e tente novamente.</p>
            <button type="button" onClick={reset}>Tentar novamente</button>
          </section>
        </main>
      </body>
    </html>
  );
}
