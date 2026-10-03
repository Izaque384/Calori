import Link from "next/link";

const features = [
  ["Cardápio digital", "Produtos, categorias, adicionais e disponibilidade em uma experiência feita para celular."],
  ["Pedidos pela mesa", "O cliente monta o pedido e o restaurante recebe tudo no painel."],
  ["Atendimento", "Chamar o garçom e pedir a conta sem transformar a experiência em algo impessoal."],
];

export default function Home() {
  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "72px 24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 88 }}>
        <strong style={{ fontSize: 28, letterSpacing: "-0.04em" }}>Calori<span style={{ color: "var(--terracotta)" }}>.</span></strong>
        <nav style={{ display: "flex", gap: 12, alignItems: "center" }}><Link href="/auth/sign-in" style={{ color: "var(--muted)", fontSize: 14 }}>Entrar</Link><Link href="/auth/sign-up" style={{ background: "var(--terracotta)", color: "white", padding: "10px 14px", borderRadius: 12, fontSize: 14, fontWeight: 700 }}>Começar agora</Link></nav>
      </header>

      <section style={{ maxWidth: 780 }}>
        <p style={{ color: "var(--terracotta)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", fontSize: 12 }}>Cardápio e atendimento digital</p>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(48px, 8vw, 88px)", lineHeight: .96, letterSpacing: "-.05em", margin: "18px 0 28px" }}>
          A experiência digital do seu restaurante.
        </h1>
        <p style={{ maxWidth: 650, fontSize: 20, lineHeight: 1.6, color: "var(--muted)" }}>
          Cardápio, pedidos e atendimento em uma experiência simples, elegante e próxima.
        </p>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, marginTop: 72 }}>
        {features.map(([title, text]) => (
          <article key={title} style={{ background: "#fffaf2", border: "1px solid #e8dfd4", borderRadius: 24, padding: 28 }}>
            <h2 style={{ fontFamily: "Georgia, serif", marginTop: 0 }}>{title}</h2>
            <p style={{ color: "var(--muted)", lineHeight: 1.6, marginBottom: 0 }}>{text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
