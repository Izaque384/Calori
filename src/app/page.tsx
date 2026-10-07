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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 28 }}>
          <Link href="/auth/sign-up" style={{ background: "var(--terracotta)", color: "white", padding: "13px 18px", borderRadius: 12, fontSize: 14, fontWeight: 800 }}>
            Testar grátis por 14 dias
          </Link>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>Sem cartão · depois R$ 59/mês</span>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, marginTop: 72 }}>
        {features.map(([title, text]) => (
          <article key={title} style={{ background: "#fffaf2", border: "1px solid #e8dfd4", borderRadius: 24, padding: 28 }}>
            <h2 style={{ fontFamily: "Georgia, serif", marginTop: 0 }}>{title}</h2>
            <p style={{ color: "var(--muted)", lineHeight: 1.6, marginBottom: 0 }}>{text}</p>
          </article>
        ))}
      </section>

      <section style={{ marginTop: 72, background: "#1f1f1f", color: "white", borderRadius: 28, padding: "clamp(28px, 6vw, 52px)", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 28, alignItems: "center" }}>
        <div>
          <p style={{ margin: 0, color: "#e7b69e", textTransform: "uppercase", letterSpacing: ".12em", fontSize: 11, fontWeight: 800 }}>Plano único</p>
          <h2 style={{ margin: "10px 0 12px", fontFamily: "Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)" }}>R$ 59/mês</h2>
          <p style={{ margin: 0, color: "#d9d3cc", lineHeight: 1.6 }}>Todos os recursos. Um restaurante. Cancele quando quiser.</p>
        </div>
        <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
          <strong>14 dias grátis</strong>
          <span style={{ color: "#d9d3cc", fontSize: 13 }}>Sem cartão no início.</span>
          <Link href="/auth/sign-up" style={{ marginTop: 6, background: "var(--terracotta)", color: "white", padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 800 }}>
            Começar agora
          </Link>
        </div>
      </section>
    </main>
  );
}
