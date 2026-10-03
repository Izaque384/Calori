type Props = { params: Promise<{ restaurante: string; mesa: string }> };

export default async function PublicMenuPage({ params }: Props) {
  const { restaurante, mesa } = await params;

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px" }}>
      <p style={{ color: "var(--terracotta)", fontWeight: 700 }}>CALORI</p>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: 42 }}>Cardápio</h1>
      <p style={{ color: "var(--muted)" }}>Restaurante: {restaurante} · Mesa: {mesa}</p>
      <div style={{ marginTop: 36, padding: 24, border: "1px dashed #cbbdaf", borderRadius: 20 }}>
        A experiência pública do cardápio será conectada ao Neon no bloco de Cardápio e Mesas.
      </div>
    </main>
  );
}
