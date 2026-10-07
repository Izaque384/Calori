import Link from "next/link";
import CaloriBrand from "@/components/calori-brand";

const features = [
  {
    eyebrow: "Cardápio",
    title: "Cardápio digital no seu estilo",
    text: "Produtos, categorias, adicionais e disponibilidade em uma experiência pensada para o celular.",
  },
  {
    eyebrow: "Pedidos",
    title: "Pedidos direto para a operação",
    text: "O cliente monta o pedido e sua equipe acompanha tudo em um painel simples e organizado.",
  },
  {
    eyebrow: "Atendimento",
    title: "Serviço mais ágil, sem perder o toque humano",
    text: "Chamados, pedidos de conta e acompanhamento da mesa sem tornar a experiência impessoal.",
  },
  {
    eyebrow: "Gestão",
    title: "Relatórios para decisões melhores",
    text: "Entenda o ritmo do salão, os itens mais pedidos e o volume da operação.",
  },
];

export default function Home() {
  return (
    <main className="landing-shell">
      <header className="landing-header">
        <Link href="/" aria-label="Calori — início">
          <CaloriBrand compact />
        </Link>

        <nav className="landing-nav" aria-label="Navegação principal">
          <a href="#recursos">Recursos</a>
          <a href="#experiencia">Como funciona</a>
          <a href="#preco">Preço</a>
        </nav>

        <div className="landing-header-actions">
          <Link className="landing-login" href="/auth/sign-in">Entrar</Link>
          <Link className="primary-button landing-header-cta" href="/auth/sign-up">Começar grátis</Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-overlay" />
        <div className="landing-hero-content">
          <span className="landing-pill">Cardápio digital e atendimento</span>
          <h1>Mais sabor na experiência do seu cliente.</h1>
          <p>
            Cardápio digital, pedidos e gestão em um só lugar.
            Simples, elegante e feito para o dia a dia do seu restaurante.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-primary-cta" href="/auth/sign-up">
              Começar 14 dias grátis <span aria-hidden="true">→</span>
            </Link>
            <span>Sem cartão · depois R$ 59/mês</span>
          </div>
        </div>

        <div className="landing-feature-strip" id="recursos">
          {features.map((feature, index) => (
            <article key={feature.title}>
              <span className="landing-feature-number">0{index + 1}</span>
              <div>
                <small>{feature.eyebrow}</small>
                <strong>{feature.title}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-editorial" id="experiencia">
        <div
          className="landing-editorial-photo"
          role="img"
          aria-label="Mesa de restaurante elegante preparada para receber clientes"
        />
        <div className="landing-editorial-copy">
          <span className="section-kicker">Simples, elegante e próxima</span>
          <h2>Tecnologia que valoriza o que realmente importa.</h2>
          <p>
            O Calori cuida da parte digital para sua equipe focar no que faz de melhor:
            oferecer boas experiências à mesa.
          </p>

          <div className="landing-benefit-list">
            {features.slice(0, 3).map((feature) => (
              <div key={feature.title}>
                <span />
                <div>
                  <strong>{feature.title}</strong>
                  <p>{feature.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-showcase">
        <div className="landing-showcase-copy">
          <span className="landing-pill light">Cardápio digital</span>
          <h2>Uma experiência no seu estilo.</h2>
          <p>
            Fotos que despertam o apetite, organização por categorias e um visual que combina
            com o seu restaurante.
          </p>
          <Link href="/auth/sign-up">Criar meu cardápio <span aria-hidden="true">→</span></Link>
        </div>

        <div className="landing-phone" aria-hidden="true">
          <div className="landing-phone-top">
            <CaloriBrand compact />
            <span>●</span>
          </div>
          <div className="landing-phone-search">Buscar no cardápio...</div>
          <div className="landing-phone-chips">
            <span className="active">Destaques</span>
            <span>Entradas</span>
            <span>Pratos</span>
          </div>
          <strong className="landing-phone-title">Destaques</strong>
          <div className="landing-phone-product">
            <div className="burger-thumb" />
            <div><strong>Burger Clássico</strong><small>Pão brioche, blend 180g...</small><b>R$ 32,90</b></div>
            <span>+</span>
          </div>
          <div className="landing-phone-product">
            <div className="risotto-thumb" />
            <div><strong>Risoto de Camarão</strong><small>Arroz cremoso e ervas...</small><b>R$ 48,90</b></div>
            <span>+</span>
          </div>
        </div>
      </section>

      <section className="landing-pricing" id="preco">
        <div>
          <span className="section-kicker">Plano único</span>
          <h2>R$ 59<small>/mês</small></h2>
          <p>Todos os recursos. Um restaurante. Cancele quando quiser.</p>
        </div>
        <div className="landing-pricing-side">
          <strong>14 dias grátis</strong>
          <span>Sem cartão no início.</span>
          <Link className="landing-primary-cta" href="/auth/sign-up">
            Começar agora <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <CaloriBrand compact />
        <p>A experiência digital do seu restaurante.</p>
        <span>© 2026 Calori</span>
      </footer>
    </main>
  );
}
